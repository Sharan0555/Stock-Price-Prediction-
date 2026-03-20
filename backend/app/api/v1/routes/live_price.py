from __future__ import annotations

import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.services.alpha_vantage_service import AlphaVantageService
from app.services.live_price_service import LivePriceService
from app.services.yfinance_service import YFinanceService


router = APIRouter()
_yfinance_service = YFinanceService()
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class LivePriceResponse(BaseModel):
    symbol: str
    price: float
    change_pct: float | None = None
    volume: int = 0
    ts: int
    source: str

def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _coerce_live_response(payload: dict, *, source: str) -> LivePriceResponse | None:
    try:
        return LivePriceResponse(
            symbol=_normalize_symbol(str(payload["symbol"])),
            price=float(payload["price"]),
            change_pct=(
                float(payload["change_pct"])
                if payload.get("change_pct") is not None
                else None
            ),
            volume=int(payload.get("volume") or 0),
            ts=int(payload["ts"]),
            source=source,
        )
    except (KeyError, TypeError, ValueError):
        return None


def get_live_price_service(request: Request) -> LivePriceService:
    return request.app.state.live_price_service


def get_alpha_vantage_service(request: Request) -> AlphaVantageService:
    return request.app.state.alpha_vantage_service


async def _resolve_price(
    symbol: str,
    live_price_service: LivePriceService,
    alpha_vantage_service: AlphaVantageService,
) -> LivePriceResponse | None:
    normalized = _normalize_symbol(symbol)
    redis_key = live_price_service._cache_key(normalized)
    cached_trade = await live_price_service.get_price(normalized)
    logger.debug(
        "Live price lookup key=%s found=%s",
        redis_key,
        cached_trade is not None,
    )
    if cached_trade:
        response = _coerce_live_response(cached_trade, source="finnhub-ws")
        if response is not None:
            return response

    alpha_quote = await alpha_vantage_service.get_quote(normalized)
    if alpha_quote:
        return _coerce_live_response(alpha_quote, source="alpha_vantage")

    is_inr = normalized.endswith((".NS", ".NSE", ".BO", ".BSE"))
    yfinance_quote = await _yfinance_service.get_quote(normalized, is_inr=is_inr)
    if yfinance_quote and yfinance_quote.get("c") is not None:
        ts = int(yfinance_quote.get("t") or 0)
        if ts and ts < 10_000_000_000:
            ts *= 1000
        return LivePriceResponse(
            symbol=normalized,
            price=float(yfinance_quote["c"]),
            change_pct=(
                float(yfinance_quote["dp"])
                if yfinance_quote.get("dp") is not None
                else None
            ),
            volume=int(yfinance_quote.get("v") or 0),
            ts=ts or 0,
            source="yfinance",
        )

    return None


@router.get("/stocks/live-price/{symbol}", response_model=LivePriceResponse)
async def get_live_price(
    symbol: str,
    live_price_service: Annotated[LivePriceService, Depends(get_live_price_service)],
    alpha_vantage_service: Annotated[
        AlphaVantageService, Depends(get_alpha_vantage_service)
    ],
) -> LivePriceResponse:
    response = await _resolve_price(symbol, live_price_service, alpha_vantage_service)
    if response is None:
        raise HTTPException(
            status_code=404,
            detail=f"No live price available for {_normalize_symbol(symbol)}.",
        )
    return response


@router.get("/stocks/batch-price", response_model=list[LivePriceResponse])
async def get_batch_prices(
    symbols: Annotated[str, Query(min_length=1)],
    live_price_service: Annotated[LivePriceService, Depends(get_live_price_service)],
    alpha_vantage_service: Annotated[
        AlphaVantageService, Depends(get_alpha_vantage_service)
    ],
) -> list[LivePriceResponse]:
    requested_symbols: list[str] = []
    seen: set[str] = set()

    for raw_symbol in symbols.split(","):
        normalized = _normalize_symbol(raw_symbol)
        if not normalized or normalized in seen:
            continue
        requested_symbols.append(normalized)
        seen.add(normalized)

    if not requested_symbols:
        raise HTTPException(status_code=400, detail="At least one symbol is required.")
    if len(requested_symbols) > 20:
        raise HTTPException(status_code=400, detail="A maximum of 20 symbols is allowed.")

    results = await asyncio.gather(
        *[
            _resolve_price(symbol, live_price_service, alpha_vantage_service)
            for symbol in requested_symbols
        ]
    )
    return [price for price in results if price is not None]


@router.websocket("/stocks/ws/{symbol}")
async def stream_live_price(symbol: str, websocket: WebSocket) -> None:
    live_price_service: LivePriceService = websocket.app.state.live_price_service
    normalized = _normalize_symbol(symbol)
    last_ts: int | None = None
    last_price: float | None = None

    await websocket.accept()
    try:
        while True:
            payload = await live_price_service.get_price(normalized)
            if payload:
                current_price = payload.get("price")
                current_ts = payload.get("ts")
                if current_price != last_price or current_ts != last_ts:
                    response = _coerce_live_response(payload, source="finnhub-ws")
                    if response is not None:
                        await websocket.send_json(response.model_dump())
                        last_price = response.price
                        last_ts = response.ts
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return
