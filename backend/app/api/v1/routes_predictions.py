import hashlib, json, time

_cache: dict = {}

def _cache_get(key: str):
    entry = _cache.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.time() > expires_at:
        del _cache[key]
        return None
    return value

def _cache_set(key: str, value, ttl: int = 300):
    _cache[key] = (value, time.time() + ttl)

from typing import List, Literal

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

from app.ml.inference import prediction_engine


router = APIRouter()


class PredictionRequestBody(BaseModel):
    symbol: str
    closes: List[float] = Field(..., min_length=1)


class RiskInfo(BaseModel):
    score: float
    level: Literal["low", "medium", "high"]
    signal: Literal["BUY", "HOLD", "SELL"]
    last_price: float
    change_pct: float


def _compute_risk_and_signal(closes: List[float], predicted: float) -> RiskInfo:
    import numpy as np

    arr = np.asarray(closes, dtype=float)
    last_price = float(arr[-1])

    returns = np.diff(arr) / arr[:-1] if arr.size > 1 else np.array([0.0])
    vol = float(np.std(returns)) if returns.size > 0 else 0.0
    score = max(0.0, min(100.0, vol * 1000.0))

    if score < 25:
        level: Literal["low", "medium", "high"] = "low"
    elif score < 60:
        level = "medium"
    else:
        level = "high"

    change_pct = (predicted - last_price) / last_price * 100 if last_price else 0.0

    trend_pct = 0.0
    if arr.size >= 15 and arr[-15] != 0:
        trend_pct = float((arr[-1] - arr[-15]) / arr[-15] * 100)

    # Bias toward a clear BUY/SELL so the UI isn't stuck on "SELL" for mild dips.
    if trend_pct >= 0.75 or (change_pct >= 0.35 and level != "high"):
        signal: Literal["BUY", "HOLD", "SELL"] = "BUY"
    elif trend_pct <= -0.75 or (change_pct <= -0.35 and level == "high"):
        signal = "SELL"
    else:
        signal = "BUY" if trend_pct >= 0 else "SELL"

    return RiskInfo(
        score=round(score, 2),
        level=level,
        signal=signal,
        last_price=last_price,
        change_pct=round(change_pct, 2),
    )


@router.post("")
def predict_price(body: PredictionRequestBody = Body(...)) -> dict:
    cache_key = hashlib.md5(
        json.dumps({"s": body.symbol.upper(), "c": body.closes[-10:]}, sort_keys=True).encode()
    ).hexdigest()
    cached = _cache_get(cache_key)
    if cached is not None:
        cached["cached"] = True
        return cached
    try:
        result = prediction_engine.predict_next_price(body.closes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    risk = _compute_risk_and_signal(body.closes, result["ensemble"])
    response = {
        "symbol": body.symbol.upper(),
        "predictions": result,
        "risk": risk.model_dump(),
        "cached": False,
    }
    _cache_set(cache_key, response, ttl=300)
    return response
