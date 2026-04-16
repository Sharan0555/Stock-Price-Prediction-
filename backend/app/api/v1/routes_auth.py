import json
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import httpx

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password


router = APIRouter()

def _resolve_users_path() -> Path:
    base_dir = Path(__file__).resolve().parents[3]
    repo_data = base_dir.parent / "data"
    if repo_data.exists():
        return repo_data / "users.json"
    return base_dir / "data" / "users.json"


# Resolve to ./data/users.json in the repo, or /app/data/users.json in container.
_USERS_PATH = _resolve_users_path()
_USERS_LOCK = Lock()


def _load_users() -> dict[str, dict]:
    if not _USERS_PATH.exists():
        return {}
    try:
        raw = _USERS_PATH.read_text(encoding="utf-8").strip()
        if not raw:
            return {}
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_users(users: dict[str, dict]) -> None:
    _USERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _USERS_PATH.with_suffix(_USERS_PATH.suffix + ".tmp")
    tmp.write_text(json.dumps(users, ensure_ascii=True, indent=2), encoding="utf-8")
    tmp.replace(_USERS_PATH)


class RegisterBody(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)


class LoginBody(BaseModel):
    email: str
    password: str


class FirebaseAuthBody(BaseModel):
    idToken: str = Field(..., min_length=20)


@router.post("/register")
def register(body: RegisterBody) -> dict:
    email = body.email.strip().lower()
    with _USERS_LOCK:
        users = _load_users()
        if email in users:
            raise HTTPException(status_code=400, detail="User already exists")
        users[email] = {
            "email": email,
            "password_hash": get_password_hash(body.password),
        }
        _save_users(users)
    token = create_access_token(subject=email)
    return {"access_token": token, "token_type": "bearer", "user": {"email": email}}


@router.post("/login")
def login(body: LoginBody) -> dict:
    email = body.email.strip().lower()
    with _USERS_LOCK:
        users = _load_users()
        user = users.get(email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found. Please register.")
        password_hash = str(user.get("password_hash", "")).strip()
        if not password_hash:
            raise HTTPException(
                status_code=400,
                detail="Password login is unavailable for this account.",
            )
        if not verify_password(body.password, password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token(subject=email)
    return {"access_token": token, "token_type": "bearer", "user": {"email": email}}


@router.post("/firebase")
async def firebase_auth(body: FirebaseAuthBody) -> dict:
    """
    Authenticate using Firebase ID token.
    Verifies the Firebase token with Google's public keys and returns a JWT.
    """
    if not settings.FIREBASE_PROJECT_ID:
        raise HTTPException(status_code=503, detail="Firebase authentication is not configured.")

    try:
        # Verify Firebase ID token using Google's public keys
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
            )
            response.raise_for_status()
            public_keys = response.json()

        # For simplicity, we'll use Firebase Admin SDK in production
        # For now, we'll decode the token without verification (NOT SECURE FOR PRODUCTION)
        # In production, use firebase-admin package
        import jwt
        from jwt import PyJWKClient

        # Get the key ID from the token header
        decoded_header = jwt.get_unverified_header(body.idToken)
        kid = decoded_header.get("kid")

        if not kid:
            raise HTTPException(status_code=401, detail="Invalid Firebase token: missing key ID")

        # Get the public key
        public_key = public_keys.get(kid)
        if not public_key:
            raise HTTPException(status_code=401, detail="Invalid Firebase token: key not found")

        # Verify the token
        try:
            decoded = jwt.decode(
                body.idToken,
                public_key,
                algorithms=["RS256"],
                audience=settings.FIREBASE_PROJECT_ID,
                issuer=f"https://securetoken.google.com/{settings.FIREBASE_PROJECT_ID}",
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Firebase token expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {str(e)}")

        email = decoded.get("email", "").strip().lower()
        if not email:
            raise HTTPException(status_code=400, detail="Firebase token did not provide an email")

        if not decoded.get("email_verified"):
            raise HTTPException(status_code=401, detail="Firebase email is not verified")

        # Create or update user
        with _USERS_LOCK:
            users = _load_users()
            users[email] = {
                "email": email,
                "provider": "firebase",
            }
            _save_users(users)

        token = create_access_token(subject=email)
        return {"access_token": token, "token_type": "bearer", "user": {"email": email}}

    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Failed to verify Firebase token: {str(e)}")
