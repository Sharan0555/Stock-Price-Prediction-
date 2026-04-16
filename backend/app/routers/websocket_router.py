from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.local_data_service import LocalDataService
from app.services.yfinance_service import YFinanceService


router = APIRouter()
_local_data_service = LocalDataService()
_yfinance_service = YFinanceService()


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


def _quote_from_live_payload(payload: dict[str, Any], *, source: str) -> dict[str, Any]:
    return {
        "symbol": _normalize_symbol(str(payload.get("symbol", ""))),
        "price": float(payload["price"]),
        "change_pct": (
            float(payload["change_pct"])
            if payload.get("change_pct") is not None
            else None
        ),
        "volume": int(payload.get("volume") or 0),
        "ts": int(payload.get("ts") or 0),
        "source": source,
    }


async def _resolve_snapshot(websocket: WebSocket, symbol: str) -> dict[str, Any]:
    normalized = _normalize_symbol(symbol)
    live_price_service = websocket.app.state.live_price_service
    alpha_vantage_service = websocket.app.state.alpha_vantage_service

    live_payload = await live_price_service.get_price(normalized)
    if live_payload:
        return _quote_from_live_payload(live_payload, source="finnhub-ws")

    alpha_quote = await alpha_vantage_service.get_quote(normalized)
    if alpha_quote:
        return _quote_from_live_payload(alpha_quote, source="alpha_vantage")

    is_inr = _looks_like_inr_symbol(normalized)
    yfinance_quote = await _yfinance_service.get_quote(normalized, is_inr=is_inr)
    if yfinance_quote and yfinance_quote.get("c") is not None:
        ts = int(yfinance_quote.get("t") or 0)
        if ts and ts < 10_000_000_000:
            ts *= 1000
        return {
            "symbol": normalized,
            "price": float(yfinance_quote["c"]),
            "change_pct": (
                float(yfinance_quote["dp"])
                if yfinance_quote.get("dp") is not None
                else None
            ),
            "volume": int(yfinance_quote.get("v") or 0),
            "ts": ts,
            "source": "yfinance",
        }

    quote = _local_data_service.get_quote(normalized, _currency_for_symbol(normalized))
    return {
        "symbol": normalized,
        "price": float(quote.get("c", 0.0)),
        "change_pct": (
            round(
                ((float(quote.get("c", 0.0)) - float(quote.get("pc", 0.0)))
                / float(quote.get("pc", 1.0)))
                * 100,
                2,
            )
            if quote.get("pc")
            else None
        ),
        "volume": int(quote.get("v") or 0),
        "ts": int(quote.get("t") or 0) * 1000 if quote.get("t") else 0,
        "source": "local",
    }


@router.websocket("/api/v1/ws/prices/{symbol}")
async def stream_price_updates(symbol: str, websocket: WebSocket) -> None:
    normalized = _normalize_symbol(symbol)
    last_ts: int | None = None
    last_price: float | None = None

    await websocket.accept()
    try:
        initial = await _resolve_snapshot(websocket, normalized)
        await websocket.send_json(initial)
        last_ts = int(initial.get("ts") or 0)
        last_price = float(initial.get("price") or 0.0)

        while True:
            payload = await _resolve_snapshot(websocket, normalized)
            current_ts = int(payload.get("ts") or 0)
            current_price = float(payload.get("price") or 0.0)
            if current_ts != last_ts or current_price != last_price:
                await websocket.send_json(payload)
                last_ts = current_ts
                last_price = current_price
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        return
