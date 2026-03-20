from __future__ import annotations

import asyncio
import json
import logging
import os
import ssl
from time import time
from typing import Any

import certifi
import websockets
import yfinance as yf
from redis import asyncio as redis_async
from redis.exceptions import ConnectionError

from app.core.config import settings


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

FINNHUB_SUBSCRIPTIONS = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "TSLA",
    "NVDA",
    "AMZN",
    "META",
    "NFLX",
    "AMD",
    "INTC",
]


class LivePriceService:
    def __init__(self) -> None:
        self._api_key = os.getenv("FINNHUB_API_KEY", settings.FINNHUB_API_KEY)
        self._redis_url = os.getenv("REDIS_URL", settings.REDIS_URL)
        self._symbols = FINNHUB_SUBSCRIPTIONS
        self._redis = redis_async.from_url(self._redis_url, decode_responses=True)
        self._fallback_cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._price_cache: dict[str, dict[str, Any]] = {}
        self._daily_change: dict[str, float] = {}
        self._ssl_context = ssl.create_default_context(cafile=certifi.where())
        self._redis_available = True
        self._redis_warning_logged = False

    @staticmethod
    def _cache_key(symbol: str) -> str:
        return f"stock:price:{symbol.upper()}"

    @staticmethod
    def _normalize_symbol(symbol: str) -> str:
        return symbol.strip().upper()

    @staticmethod
    def _as_float(value: Any) -> float | None:
        try:
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _as_int(value: Any, default: int = 0) -> int:
        try:
            return int(float(value)) if value is not None else default
        except (TypeError, ValueError):
            return default

    async def _store_trade(self, trade: dict[str, Any]) -> None:
        symbol = self._normalize_symbol(str(trade.get("s", "")))
        price = self._as_float(trade.get("p"))
        if not symbol or price is None:
            return

        payload = {
            "symbol": symbol,
            "price": price,
            "volume": self._as_int(trade.get("v"), default=0),
            "ts": self._as_int(trade.get("t"), default=int(time() * 1000)),
        }
        
        # Add change_pct if available
        if symbol in self._daily_change:
            payload["change_pct"] = self._daily_change[symbol]
        
        self._fallback_cache[symbol] = (time() + 60, payload)
        self._price_cache[symbol] = payload
        
        if self._redis_available:
            try:
                await self._redis.set(self._cache_key(symbol), json.dumps(payload), ex=60)
            except ConnectionError:
                if not self._redis_warning_logged:
                    logger.warning("Redis unavailable — using in-memory cache")
                    self._redis_warning_logged = True
                self._redis_available = False
            except Exception:
                # Keep the stream alive even if Redis is temporarily unavailable.
                pass

    async def get_price(self, symbol: str) -> dict | None:
        normalized = self._normalize_symbol(symbol)
        
        # Try in-memory cache first
        if normalized in self._price_cache:
            return self._price_cache[normalized]
        
        # Try Redis if available
        if self._redis_available:
            try:
                cached = await self._redis.get(self._cache_key(normalized))
                if cached:
                    try:
                        data = json.loads(cached)
                        if isinstance(data, dict):
                            self._price_cache[normalized] = data
                            return data
                    except json.JSONDecodeError:
                        pass
            except ConnectionError:
                if not self._redis_warning_logged:
                    logger.warning("Redis unavailable — using in-memory cache")
                    self._redis_warning_logged = True
                self._redis_available = False
            except Exception:
                pass

        # Fallback to timestamp-based cache
        fallback = self._fallback_cache.get(normalized)
        if not fallback:
            return None
        expires_at, data = fallback
        if time() > expires_at:
            self._fallback_cache.pop(normalized, None)
            return None
        self._price_cache[normalized] = data
        return data

    async def _fetch_daily_changes(self) -> None:
        """Fetch previous close prices and calculate daily changes"""
        for symbol in self._symbols:
            try:
                ticker = yf.Ticker(symbol)
                prev_close = ticker.fast_info.get('previous_close')
                if prev_close and prev_close > 0:
                    # Get current price from cache or market data
                    current_data = await self.get_price(symbol)
                    if current_data and 'price' in current_data:
                        current_price = current_data['price']
                        change_pct = ((current_price - prev_close) / prev_close) * 100
                        self._daily_change[symbol] = change_pct
            except Exception as e:
                logger.debug(f"Failed to fetch daily change for {symbol}: {e}")
                continue

    async def _daily_change_updater(self) -> None:
        """Background task to update daily changes every 60 seconds"""
        while True:
            try:
                await self._fetch_daily_changes()
                await asyncio.sleep(60)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Error in daily change updater")
                await asyncio.sleep(60)

    async def run(self) -> None:
        # Start daily change updater
        updater_task = asyncio.create_task(self._daily_change_updater())
        
        try:
            while True:
                if not self._api_key:
                    await asyncio.sleep(5)
                    continue

                websocket_url = f"wss://ws.finnhub.io?token={self._api_key}"
                try:
                    async with websockets.connect(
                        websocket_url,
                        ping_interval=20,
                        ping_timeout=20,
                        close_timeout=5,
                        ssl=self._ssl_context,
                    ) as websocket:
                        for symbol in self._symbols:
                            await websocket.send(
                                json.dumps({"type": "subscribe", "symbol": symbol})
                            )
                        logger.info(
                            "Finnhub WS connected and subscribed to %s",
                            ", ".join(self._symbols),
                        )

                        async for raw_message in websocket:
                            message = json.loads(raw_message)
                            if message.get("type") != "trade":
                                continue
                            for trade in message.get("data", []) or []:
                                await self._store_trade(trade)
                except asyncio.CancelledError:
                    raise
                except Exception:
                    logger.exception("Finnhub WS disconnected; retrying in 5 seconds")
                    await asyncio.sleep(5)
        finally:
            updater_task.cancel()
            try:
                await updater_task
            except asyncio.CancelledError:
                pass

    async def close(self) -> None:
        if self._redis_available:
            try:
                await self._redis.aclose()
            except Exception:
                pass
