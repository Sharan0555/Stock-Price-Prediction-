import asyncio
import json
import os
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import (
    routes_auth,
    routes_health,
    routes_portfolio,
    routes_predictions,
    routes_stocks,
)
from app.api.v1.routes import live_price as live_price_routes
from app.ml.model_registry import MODELS_DIR, load_all
from app.ml.sentiment_service import SentimentService
from app.ml.model_trainer import ModelTrainer
from app.routers.prediction_router import router as prediction_router
from app.routers.websocket_router import router as websocket_router
from app.routes.prices import router as prices_router
from app.routes.finnhub_ws import router as finnhub_ws_router, finnhub_listener
from app.routes.news import router as news_router
from app.services.alpha_vantage_service import AlphaVantageService
from app.services.live_price_service import LivePriceService
from app.services.yfinance_service import YFinanceService

PREWARM_SYMBOLS = ["AAPL", "TSLA", "GOOGL", "MSFT", "AMZN", "NVDA", "META", "NFLX", "AMD", "BABA"]

DEFAULT_CORS_ORIGINS = [
    "*",
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://localhost:80",
    "http://127.0.0.1:80",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
AUTO_TRAIN_TICKERS = ("AAPL", "TSLA", "GOOGL", "MSFT")


def _ensure_default_models() -> None:
    trainer = ModelTrainer()
    for ticker in AUTO_TRAIN_TICKERS:
        model_path = MODELS_DIR / f"{ticker}.keras"
        if model_path.exists():
            continue
        try:
            trainer.train(ticker)
        except Exception as exc:
            print(f"[startup] Failed to train {ticker}: {exc}")


def _prewarm_stock_cache():
    """Pre-warm stock cache for popular symbols on startup."""
    try:
        yf_service = YFinanceService()
        yf_service.get_multiple_quotes(PREWARM_SYMBOLS, is_inr=False)
    except Exception as exc:
        print(f"[startup] Cache pre-warm warning (non-critical): {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_all()
    live_price_service = LivePriceService()
    alpha_vantage_service = AlphaVantageService()
    sentiment_service = SentimentService()
    yfinance_service = YFinanceService()

    app.state.live_price_service = live_price_service
    app.state.alpha_vantage_service = alpha_vantage_service
    app.state.sentiment_service = sentiment_service
    app.state.yfinance_service = yfinance_service

    if not os.getenv("PYTEST_CURRENT_TEST"):
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, sentiment_service.preload)
        await loop.run_in_executor(None, _ensure_default_models)
        # Pre-warm stock cache concurrently
        await loop.run_in_executor(None, _prewarm_stock_cache)

    background_tasks = [
        asyncio.create_task(live_price_service.run(), name="live-price-feed"),
        asyncio.create_task(finnhub_listener(), name="legacy-finnhub-feed"),
    ]
    app.state.background_tasks = background_tasks

    try:
        yield
    finally:
        for task in background_tasks:
            task.cancel()
        for task in background_tasks:
            with suppress(asyncio.CancelledError):
                await task
        await live_price_service.close()
        await alpha_vantage_service.aclose()


def _get_allowed_origins() -> list[str]:
    raw_cors_origins = os.getenv("BACKEND_CORS_ORIGINS", "").strip()
    if raw_cors_origins:
        cors_origins = json.loads(raw_cors_origins)
    else:
        cors_origins = DEFAULT_CORS_ORIGINS.copy()

    frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if frontend_url and frontend_url not in cors_origins:
        cors_origins.append(frontend_url)

    return [str(origin).rstrip("/") for origin in cors_origins]


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Stock Price Prediction API",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_get_allowed_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(routes_health.router, prefix="/api/v1/health", tags=["health"])
    app.include_router(routes_auth.router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(routes_stocks.router, prefix="/api/v1/stocks", tags=["stocks"])
    app.include_router(live_price_routes.router, prefix="/api/v1", tags=["stocks"])
    app.include_router(
        routes_predictions.router,
        prefix="/api/v1/predictions",
        tags=["predictions"],
    )
    app.include_router(
        routes_portfolio.router,
        prefix="/api/v1/portfolio",
        tags=["portfolio"],
    )
    app.include_router(prediction_router, tags=["predictions"])
    app.include_router(websocket_router, tags=["prices"])
    app.include_router(prices_router, tags=["prices"])
    app.include_router(finnhub_ws_router, tags=["prices"])
    app.include_router(news_router, tags=["news"])

    return app


app = create_app()
