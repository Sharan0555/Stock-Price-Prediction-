from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from time import time
from typing import Dict

import httpx
from redis import asyncio as redis_async
from redis.exceptions import ConnectionError

from app.core.config import settings


logger = logging.getLogger(__name__)


class AlphaVantageService:
    def __init__(self) -> None:
        self._client = httpx.Client(timeout=10.0)
        self._async_client: httpx.AsyncClient | None = None
        self._api_key = settings.ALPHAVANTAGE_API_KEY
        self._base_url = settings.ALPHAVANTAGE_BASE_URL
        self._cache: Dict[str, tuple[float, dict]] = {}
        self._rate_limited_until: float = 0.0
        self._redis = redis_async.from_url(settings.REDIS_URL, decode_responses=True)
        self._redis_available = True
        self._redis_warning_logged = False

    def _cache_get(self, symbol: str, ttl: int) -> dict | None:
        cached = self._cache.get(symbol)
        if not cached:
            return None
        ts, data = cached
        if time() - ts > ttl:
            return None
        return data

    def _cache_get_any(self, symbol: str) -> dict | None:
        cached = self._cache.get(symbol)
        if not cached:
            return None
        return cached[1]

    def _cache_set(self, symbol: str, data: dict) -> None:
        self._cache[symbol] = (time(), data)

    @staticmethod
    def _as_float(value: str | float | int | None) -> float:
        try:
            return float(value) if value is not None else 0.0
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _as_int(value: str | float | int | None, default: int = 0) -> int:
        try:
            return int(float(value)) if value is not None else default
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _parse_percent(value: str | None) -> float | None:
        if value is None:
            return None
        cleaned = value.replace("%", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None

    @staticmethod
    def _quote_cache_key(symbol: str) -> str:
        return f"stock:quote:{symbol.upper()}"

    @staticmethod
    def _normalize_symbol(symbol: str) -> str:
        normalized = symbol.strip().upper()
        if normalized.endswith(".NS"):
            return normalized[:-3] + ".NSE"
        if normalized.endswith(".BO"):
            return normalized[:-3] + ".BSE"
        return normalized

    @staticmethod
    def _now_ms() -> int:
        return int(datetime.now(timezone.utc).timestamp() * 1000)

    def _extract_api_error(self, data: dict) -> str | None:
        message = (
            data.get("Note")
            or data.get("Error Message")
            or data.get("Information")
        )
        if not message:
            return None
        if (
            "Thank you for using Alpha Vantage" in message
            or "standard API call frequency" in message
        ):
            self._rate_limited_until = time() + 65
        return message

    def _normalize_live_quote(self, symbol: str, quote: dict) -> dict | None:
        price = self._as_float(quote.get("05. price"))
        if price <= 0:
            return None

        change_pct = self._parse_percent(quote.get("10. change percent"))
        if change_pct is None:
            previous_close = self._as_float(quote.get("08. previous close"))
            if previous_close > 0:
                change_pct = ((price - previous_close) / previous_close) * 100

        latest_trading_day = quote.get("07. latest trading day")
        ts = self._now_ms()
        if latest_trading_day:
            try:
                parsed = datetime.strptime(latest_trading_day, "%Y-%m-%d").replace(
                    tzinfo=timezone.utc
                )
                ts = int(parsed.timestamp() * 1000)
            except ValueError:
                ts = self._now_ms()

        return {
            "symbol": symbol,
            "price": price,
            "change_pct": change_pct,
            "volume": self._as_int(
                quote.get("06. Volume", quote.get("06. volume")),
                default=0,
            ),
            "ts": ts,
        }

    async def _get_async_client(self) -> httpx.AsyncClient:
        if self._async_client is None:
            self._async_client = httpx.AsyncClient(timeout=10.0)
        return self._async_client

    async def get_cached_quote(self, symbol: str) -> dict | None:
        normalized = self._normalize_symbol(symbol)
        memory_key = f"QUOTE:{normalized}"
        
        # Check memory cache first with 30s TTL
        memory_cached = self._cache_get(memory_key, ttl=30)
        if memory_cached:
            return memory_cached
        
        # Try Redis if available
        if self._redis_available:
            try:
                cached = await self._redis.get(self._quote_cache_key(normalized))
                if cached:
                    try:
                        data = json.loads(cached)
                        if isinstance(data, dict):
                            self._cache_set(memory_key, data)
                            return data
                    except json.JSONDecodeError:
                        pass
            except ConnectionError:
                if not self._redis_warning_logged:
                    logger.warning("Redis unavailable — using in-memory cache only")
                    self._redis_warning_logged = True
                self._redis_available = False
            except Exception:
                pass
        
        return None

    async def get_quote(self, symbol: str) -> dict | None:
        normalized = self._normalize_symbol(symbol)
        if not self._api_key:
            return None

        cached = await self.get_cached_quote(normalized)
        if cached:
            return cached
        if time() < self._rate_limited_until:
            return None

        params = {
            "function": "GLOBAL_QUOTE",
            "symbol": normalized,
            "apikey": self._api_key,
        }
        try:
            client = await self._get_async_client()
            response = await client.get(self._base_url, params=params)
            response.raise_for_status()
            data = response.json()
        except Exception:
            return None

        if self._extract_api_error(data):
            return None

        quote = data.get("Global Quote", {})
        if not isinstance(quote, dict) or not quote:
            return None

        normalized_quote = self._normalize_live_quote(normalized, quote)
        if not normalized_quote:
            return None

        # Store in Redis if available
        if self._redis_available:
            try:
                await self._redis.set(
                    self._quote_cache_key(normalized),
                    json.dumps(normalized_quote),
                    ex=30,
                )
            except ConnectionError:
                if not self._redis_warning_logged:
                    logger.warning("Redis unavailable — using in-memory cache only")
                    self._redis_warning_logged = True
                self._redis_available = False
            except Exception:
                pass
        self._cache_set(f"QUOTE:{normalized}", normalized_quote)
        return normalized_quote

    async def aclose(self) -> None:
        if self._async_client is not None:
            await self._async_client.aclose()
            self._async_client = None
        if self._redis_available:
            try:
                await self._redis.aclose()
            except Exception:
                pass
        self._client.close()

    def get_global_quote(self, symbol: str) -> dict:
        if not self._api_key:
            raise ValueError("ALPHAVANTAGE_API_KEY is not set")

        normalized_symbol = self._normalize_symbol(symbol)
        cached = self._cache_get(normalized_symbol, ttl=300)
        if cached:
            return cached
        if time() < self._rate_limited_until:
            cached_any = self._cache_get_any(normalized_symbol)
            if cached_any:
                return cached_any
            raise ValueError("Alpha Vantage rate limit reached. Please wait about a minute and try again.")

        params = {
            "function": "GLOBAL_QUOTE",
            "symbol": normalized_symbol,
            "apikey": self._api_key,
        }
        res = self._client.get(self._base_url, params=params)
        res.raise_for_status()
        data = res.json()

        message = self._extract_api_error(data)
        if message:
            raise ValueError(message)

        quote = data.get("Global Quote", {})
        if not quote:
            raise ValueError("Alpha Vantage returned no quote")

        normalized = {
            "c": self._as_float(quote.get("05. price")),
            "h": self._as_float(quote.get("03. high")),
            "l": self._as_float(quote.get("04. low")),
            "o": self._as_float(quote.get("02. open")),
            "pc": self._as_float(quote.get("08. previous close")),
        }

        self._cache_set(normalized_symbol, normalized)
        return normalized

    def get_first_quote(self, symbols: list[str]) -> dict:
        last_error: Exception | None = None
        for candidate in symbols:
            try:
                return self.get_global_quote(candidate)
            except Exception as exc:  # pragma: no cover - fallback tries multiple symbols
                last_error = exc
                message = str(exc)
                if "rate limit" in message.lower() or "Thank you for using Alpha Vantage" in message:
                    break
                continue
        if last_error:
            raise last_error
        raise ValueError("Alpha Vantage returned no quote")

    def get_exchange_rate(self, from_currency: str, to_currency: str) -> dict:
        if not self._api_key:
            raise ValueError("ALPHAVANTAGE_API_KEY is not set")

        from_code = from_currency.upper()
        to_code = to_currency.upper()
        cache_key = f"FX:{from_code}:{to_code}"

        cached = self._cache_get(cache_key, ttl=300)
        if cached:
            return cached
        if time() < self._rate_limited_until:
            cached_any = self._cache_get_any(cache_key)
            if cached_any:
                return cached_any
            raise ValueError("Alpha Vantage rate limit reached. Please wait about a minute and try again.")

        params = {
            "function": "CURRENCY_EXCHANGE_RATE",
            "from_currency": from_code,
            "to_currency": to_code,
            "apikey": self._api_key,
        }
        res = self._client.get(self._base_url, params=params)
        res.raise_for_status()
        data = res.json()

        message = self._extract_api_error(data)
        if message:
            raise ValueError(message)

        raw = data.get("Realtime Currency Exchange Rate", {})
        if not raw:
            raise ValueError("Alpha Vantage returned no exchange rate")

        normalized = {
            "from": raw.get("1. From_Currency Code", from_code),
            "to": raw.get("3. To_Currency Code", to_code),
            "rate": self._as_float(raw.get("5. Exchange Rate")),
            "bid": self._as_float(raw.get("8. Bid Price")),
            "ask": self._as_float(raw.get("9. Ask Price")),
            "last_refreshed": raw.get("6. Last Refreshed"),
            "timezone": raw.get("7. Time Zone"),
        }

        self._cache_set(cache_key, normalized)
        return normalized

    def get_daily_series(self, symbol: str, output_size: str = "compact") -> list[dict]:
        if not self._api_key:
            raise ValueError("ALPHAVANTAGE_API_KEY is not set")

        cache_key = f"DAILY:{symbol}:{output_size}"
        cached = self._cache_get(cache_key, ttl=21600)
        if cached:
            return cached.get("series", [])
        if time() < self._rate_limited_until:
            cached_any = self._cache_get_any(cache_key)
            if cached_any:
                return cached_any.get("series", [])
            raise ValueError("Alpha Vantage rate limit reached. Please wait about a minute and try again.")

        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol,
            "outputsize": output_size,
            "apikey": self._api_key,
        }
        res = self._client.get(self._base_url, params=params)
        res.raise_for_status()
        data = res.json()

        message = self._extract_api_error(data)
        if message:
            raise ValueError(message)

        raw_series = data.get("Time Series (Daily)")
        if not raw_series or not isinstance(raw_series, dict):
            raise ValueError("Alpha Vantage returned no daily series")

        series: list[dict] = []
        for day, values in raw_series.items():
            if not isinstance(values, dict):
                continue
            close = values.get("4. close") or values.get("5. adjusted close")
            ts = int(
                datetime.strptime(day, "%Y-%m-%d")
                .replace(tzinfo=timezone.utc)
                .timestamp()
            )
            series.append({"t": ts, "c": self._as_float(close)})

        series.sort(key=lambda item: item["t"])
        self._cache_set(cache_key, {"series": series})
        return series
