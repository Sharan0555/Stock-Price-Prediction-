from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from app.ml.feature_engineering import FeatureEngineeringService
from app.ml.model_registry import get as get_registered_model
from app.ml.model_trainer import ModelTrainer
from app.ml.sentiment_service import SentimentService
from app.services.alpha_vantage_service import AlphaVantageService
from app.services.live_price_service import LivePriceService
from app.services.local_data_service import LocalDataService
from app.services.yfinance_service import YFinanceService


router = APIRouter()
_feature_engineering = FeatureEngineeringService()
_model_trainer = ModelTrainer()
_local_data_service = LocalDataService()
_yfinance_service = YFinanceService()


class QuotePayload(BaseModel):
    c: float
    d: float | None = None
    dp: float | None = None
    h: float | None = None
    l: float | None = None
    o: float | None = None
    pc: float | None = None
    v: int | None = None
    t: int | None = None


class HistoryPoint(BaseModel):
    t: int
    c: float


class PredictionSnapshotResponse(BaseModel):
    symbol: str
    currency: str
    quote_source: str
    history_source: str
    quote: QuotePayload
    history: list[HistoryPoint]
    predictions: dict[str, float | str]
    risk: dict[str, float | str]
    indicators: dict[str, float | str | None]


class SentimentStatusResponse(BaseModel):
    loaded: bool
    device: str
    model: str


class CVFoldResponse(BaseModel):
    fold: int
    train_size: int
    validation_size: int
    mae: float
    rmse: float
    mape: float


class CVSummaryResponse(BaseModel):
    mae: float | None = None
    rmse: float | None = None
    mape: float | None = None


class CVReportResponse(BaseModel):
    symbol: str
    model_available: bool
    folds: list[CVFoldResponse]
    summary: CVSummaryResponse


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _looks_like_inr_symbol(symbol: str) -> bool:
    normalized = _normalize_symbol(symbol)
    return normalized.endswith((".NS", ".NSE", ".BO", ".BSE")) or normalized in {
        "RELIANCE",
        "TCS",
        "HDFCBANK",
        "INFY",
        "ITC",
        "SBIN",
    }


def _currency_for_symbol(symbol: str) -> str:
    return "INR" if _looks_like_inr_symbol(symbol) else "USD"


def get_live_price_service(request: Request) -> LivePriceService:
    return request.app.state.live_price_service


def get_alpha_vantage_service(request: Request) -> AlphaVantageService:
    return request.app.state.alpha_vantage_service


def get_sentiment_service(request: Request) -> SentimentService:
    return request.app.state.sentiment_service


def _quote_from_live_payload(payload: dict[str, Any]) -> dict[str, Any]:
    price = float(payload["price"])
    change_pct = payload.get("change_pct")
    previous_close = None
    if change_pct not in (None, 0):
        previous_close = price / (1 + (float(change_pct) / 100))

    return {
        "c": round(price, 2),
        "d": round(price - previous_close, 2) if previous_close else None,
        "dp": round(float(change_pct), 2) if change_pct is not None else None,
        "h": round(price, 2),
        "l": round(price, 2),
        "o": round(previous_close, 2) if previous_close else None,
        "pc": round(previous_close, 2) if previous_close else None,
        "v": int(payload.get("volume") or 0),
        "t": int(payload.get("ts") or 0),
    }


async def _resolve_quote(
    symbol: str,
    *,
    live_price_service: LivePriceService,
    alpha_vantage_service: AlphaVantageService,
    yfinance_service: YFinanceService,
    local_data_service: LocalDataService,
    allow_local: bool,
) -> tuple[dict[str, Any], str]:
    normalized = _normalize_symbol(symbol)
    live_payload = await live_price_service.get_price(normalized)
    if live_payload:
        return _quote_from_live_payload(live_payload), "finnhub-ws"

    alpha_quote = await alpha_vantage_service.get_quote(normalized)
    if alpha_quote:
        return _quote_from_live_payload(alpha_quote), "alpha_vantage"

    is_inr = _looks_like_inr_symbol(normalized)
    yfinance_quote = await yfinance_service.get_quote(normalized, is_inr=is_inr)
    if yfinance_quote and yfinance_quote.get("c"):
        return yfinance_quote, "yfinance"

    if not allow_local:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to resolve quote for {normalized}.",
        )

    return local_data_service.get_quote(normalized, _currency_for_symbol(normalized)), "local"


async def _resolve_history(
    symbol: str,
    *,
    days: int,
    yfinance_service: YFinanceService,
    local_data_service: LocalDataService,
    allow_local: bool,
) -> tuple[list[dict[str, Any]], str]:
    normalized = _normalize_symbol(symbol)
    is_inr = _looks_like_inr_symbol(normalized)
    series = await yfinance_service.get_daily_series(normalized, days, is_inr=is_inr)
    if series:
        return series[-days:], "yfinance"

    if not allow_local:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to resolve price history for {normalized}.",
        )

    return (
        local_data_service.get_series(
            normalized,
            _currency_for_symbol(normalized),
            days,
        ),
        "local",
    )


def _build_cv_report(symbol: str) -> CVReportResponse:
    normalized = _normalize_symbol(symbol)
    entry = get_registered_model(normalized) or {}
    raw_folds = entry.get("cv_scores") or []

    folds: list[CVFoldResponse] = []
    for index, raw_fold in enumerate(raw_folds, start=1):
        if not isinstance(raw_fold, dict):
            continue
        folds.append(
            CVFoldResponse(
                fold=int(raw_fold.get("fold", index)),
                train_size=int(raw_fold.get("train_size", 0)),
                validation_size=int(raw_fold.get("validation_size", 0)),
                mae=round(float(raw_fold.get("mae", 0.0)), 4),
                rmse=round(float(raw_fold.get("rmse", 0.0)), 4),
                mape=round(float(raw_fold.get("mape", 0.0)), 4),
            )
        )

    if folds:
        summary = CVSummaryResponse(
            mae=round(sum(fold.mae for fold in folds) / len(folds), 4),
            rmse=round(sum(fold.rmse for fold in folds) / len(folds), 4),
            mape=round(sum(fold.mape for fold in folds) / len(folds), 4),
        )
    else:
        summary = CVSummaryResponse()

    return CVReportResponse(
        symbol=normalized,
        model_available=bool(entry),
        folds=folds,
        summary=summary,
    )


@router.get(
    "/api/v1/predict/sentiment/status",
    response_model=SentimentStatusResponse,
)
async def get_sentiment_status(
    sentiment_service: Annotated[SentimentService, Depends(get_sentiment_service)],
) -> SentimentStatusResponse:
    return SentimentStatusResponse(**sentiment_service.status())


@router.get(
    "/api/v1/predict/{symbol}/cv-report",
    response_model=CVReportResponse,
)
async def get_cv_report(symbol: str) -> CVReportResponse:
    return _build_cv_report(symbol)


@router.get(
    "/api/v1/predict/{symbol}",
    response_model=PredictionSnapshotResponse,
)
@router.get(
    "/api/v1/predictions/{symbol}",
    response_model=PredictionSnapshotResponse,
)
async def get_prediction_snapshot(
    symbol: str,
    live_price_service: Annotated[
        LivePriceService, Depends(get_live_price_service)
    ],
    alpha_vantage_service: Annotated[
        AlphaVantageService, Depends(get_alpha_vantage_service)
    ],
    days: Annotated[int, Query(ge=30, le=365)] = 60,
    allow_local: bool = Query(True),
) -> PredictionSnapshotResponse:
    normalized = _normalize_symbol(symbol)
    quote, quote_source = await _resolve_quote(
        normalized,
        live_price_service=live_price_service,
        alpha_vantage_service=alpha_vantage_service,
        yfinance_service=_yfinance_service,
        local_data_service=_local_data_service,
        allow_local=allow_local,
    )
    history, history_source = await _resolve_history(
        normalized,
        days=days,
        yfinance_service=_yfinance_service,
        local_data_service=_local_data_service,
        allow_local=allow_local,
    )

    closes = [float(point["c"]) for point in history if point.get("c") is not None]
    if len(closes) < 30:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough history to build a prediction for {normalized}.",
        )

    predictions = _model_trainer.predict(closes, symbol=normalized)
    risk = _model_trainer.compute_risk_profile(
        closes,
        predictions["ensemble"],
        predictions.get("signal"),
    )
    indicators = _feature_engineering.summarize_indicators(history)

    return PredictionSnapshotResponse(
        symbol=normalized,
        currency=_currency_for_symbol(normalized),
        quote_source=quote_source,
        history_source=history_source,
        quote=QuotePayload(**quote),
        history=[HistoryPoint(**point) for point in history],
        predictions=predictions,
        risk=risk,
        indicators=indicators,
    )
