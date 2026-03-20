import asyncio
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
from app.core.config import settings
from app.routes.prices import router as prices_router
from app.routes.finnhub_ws import router as finnhub_ws_router, finnhub_listener
from app.routes.news import router as news_router
from app.services.alpha_vantage_service import AlphaVantageService
from app.services.live_price_service import LivePriceService


@asynccontextmanager
async def lifespan(app: FastAPI):
    live_price_service = LivePriceService()
    alpha_vantage_service = AlphaVantageService()

    app.state.live_price_service = live_price_service
    app.state.alpha_vantage_service = alpha_vantage_service

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


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Stock Price Prediction API",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    origin_regex = r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$"
    if settings.BACKEND_CORS_ORIGINS:
        origins = []
        for origin in settings.BACKEND_CORS_ORIGINS:
            cleaned = str(origin).rstrip("/")
            if cleaned and cleaned not in origins:
                origins.append(cleaned)
    else:
        origins = []
    if not origins:
        origins = [
            "http://localhost",
            "http://127.0.0.1",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=origin_regex,
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
    app.include_router(prices_router, tags=["prices"])
    app.include_router(finnhub_ws_router, tags=["prices"])
    app.include_router(news_router, tags=["news"])

    return app


app = create_app()
