from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Stock Price Prediction API"
    API_V1_STR: str = "/api/v1"

    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = Field(default_factory=list)

    # Security
    JWT_SECRET_KEY: str = Field("change-me", validation_alias="JWT_SECRET_KEY")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Databases (optional for local dev; set in .env for full features)
    POSTGRES_DSN: str = Field(
        default="postgresql+psycopg2://postgres:postgres@localhost:5432/stocks",
        validation_alias="POSTGRES_DSN",
    )
    MONGO_DSN: str = Field(
        default="mongodb://localhost:27017/stocks",
        validation_alias="MONGO_DSN",
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        validation_alias="REDIS_URL",
    )

    # Finnhub (use a real key for /stocks/search and /quote)
    FINNHUB_API_KEY: str = Field(
        default="",
        validation_alias="FINNHUB_API_KEY",
    )
    FINNHUB_BASE_URL: str = "https://finnhub.io/api/v1"

    ALPHAVANTAGE_API_KEY: str = Field(
        default="",
        validation_alias="ALPHAVANTAGE_API_KEY",
    )
    ALPHAVANTAGE_BASE_URL: str = "https://www.alphavantage.co/query"
    ALPHAVANTAGE_INR_SUFFIX: str = ".BSE"

    LOCAL_DATA_ONLY: bool = Field(default=False, validation_alias="LOCAL_DATA_ONLY")

    GOOGLE_CLIENT_ID: str = Field(default="", validation_alias="GOOGLE_CLIENT_ID")

    # Firebase Authentication
    FIREBASE_PROJECT_ID: str = Field(default="", validation_alias="FIREBASE_PROJECT_ID")
    FIREBASE_PRIVATE_KEY: str = Field(default="", validation_alias="FIREBASE_PRIVATE_KEY")
    FIREBASE_CLIENT_EMAIL: str = Field(default="", validation_alias="FIREBASE_CLIENT_EMAIL")

    # Anthropic (server-side proxy recommended; do not expose API key to browser)
    ANTHROPIC_API_KEY: str = Field(
        default="",
        validation_alias="ANTHROPIC_API_KEY",
    )
    ANTHROPIC_MODEL: str = Field(
        default="claude-3-5-sonnet-latest",
        validation_alias="ANTHROPIC_MODEL",
    )

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
