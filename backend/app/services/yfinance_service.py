from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Iterable

import yfinance as yf

_executor = ThreadPoolExecutor(max_workers=4)


class YFinanceService:
    def _to_timestamp(self, value) -> int:
        if hasattr(value, "to_pydatetime"):
            value = value.to_pydatetime()
        if getattr(value, "tzinfo", None) is None:
            value = value.replace(tzinfo=timezone.utc)
        else:
            value = value.astimezone(timezone.utc)
        return int(value.timestamp())

    def _inr_candidates(self, symbol: str) -> list[str]:
        sym = symbol.upper().strip()
        if sym.endswith(".NSE"):
            return [sym.replace(".NSE", ".NS")]
        if sym.endswith(".BSE"):
            return [sym.replace(".BSE", ".BO")]
        if sym.endswith(".NS") or sym.endswith(".BO"):
            return [sym]
        if "." in sym:
            return [sym]
        return [f"{sym}.NS", f"{sym}.BO"]

    def _fetch_series_sync(self, symbol: str, start: datetime, end: datetime) -> list[dict]:
        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start, end=end, interval="1d", auto_adjust=False)
        if df is None or df.empty:
            return []
        series: list[dict] = []
        for idx, row in df.iterrows():
            close = row.get("Close")
            if close is None:
                continue
            try:
                close_value = float(close)
            except (TypeError, ValueError):
                continue
            ts = self._to_timestamp(idx)
            series.append({"t": ts, "c": round(close_value, 2)})
        series.sort(key=lambda item: item["t"])
        return series

    def _get_company_info_sync(self, symbol: str) -> dict:
        info = yf.Ticker(symbol).info or {}
        if not info:
            return {}
        return {
            "name": info.get("shortName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "week52_high": info.get("fiftyTwoWeekHigh"),
            "week52_low": info.get("fiftyTwoWeekLow"),
            "symbol": symbol,
        }

    async def get_daily_series(self, symbol: str, days: int, *, is_inr: bool = False) -> list[dict]:
        now = datetime.now(timezone.utc)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
        end = now + timedelta(days=1)

        candidates: Iterable[str] = self._inr_candidates(symbol) if is_inr else [symbol.upper().strip()]
        loop = asyncio.get_event_loop()

        for candidate in candidates:
            c = candidate
            series = await loop.run_in_executor(_executor, lambda: self._fetch_series_sync(c, start, end))
            if series:
                return series
        return []

    async def get_company_info(self, symbol: str, *, is_inr: bool = False) -> dict:
        candidates = self._inr_candidates(symbol) if is_inr else [symbol.upper().strip()]
        loop = asyncio.get_event_loop()

        for candidate in candidates:
            c = candidate
            info = await loop.run_in_executor(_executor, lambda: self._get_company_info_sync(c))
            if info:
                return info
        return {}

    def _get_quote_sync(self, symbol: str) -> dict:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}
        if not info:
            df = ticker.history(period="1d")
            if df is not None and not df.empty:
                current_price = df["Close"].iloc[-1]
                return {
                    "c": round(float(current_price), 2),
                    "d": 0.0,
                    "dp": 0.0,
                    "h": round(float(df["High"].iloc[-1]), 2),
                    "l": round(float(df["Low"].iloc[-1]), 2),
                    "o": round(float(df["Open"].iloc[-1]), 2),
                    "pc": round(float(current_price), 2),
                    "t": int(datetime.now(timezone.utc).timestamp()),
                }
            return {}
        
        return {
            "c": info.get("currentPrice", info.get("regularMarketPrice", 0.0)),
            "d": 0.0,
            "dp": 0.0,
            "h": info.get("dayHigh", 0.0),
            "l": info.get("dayLow", 0.0),
            "o": info.get("open", 0.0),
            "pc": info.get("previousClose", 0.0),
            "t": int(datetime.now(timezone.utc).timestamp()),
        }

    async def get_quote(self, symbol: str, *, is_inr: bool = False) -> dict:
        candidates = self._inr_candidates(symbol) if is_inr else [symbol.upper().strip()]
        loop = asyncio.get_event_loop()
        for candidate in candidates:
            c = candidate
            quote = await loop.run_in_executor(_executor, lambda: self._get_quote_sync(c))
            if quote and quote.get("c", 0.0) != 0.0:
                return quote
        return {}
