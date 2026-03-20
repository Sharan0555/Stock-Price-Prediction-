from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from typing import Iterable

import pytz
import yfinance as yf

_executor = ThreadPoolExecutor(max_workers=4)


class YFinanceService:
    def _normalize_volume(self, value) -> int:
        try:
            return int(float(value)) if value is not None else 0
        except (TypeError, ValueError):
            return 0

    def _extract_volume(self, ticker: yf.Ticker, *, latest_volume=None) -> int:
        if latest_volume is not None:
            normalized = self._normalize_volume(latest_volume)
            if normalized > 0:
                return normalized

        fast_info = getattr(ticker, "fast_info", None)
        if fast_info:
            for key in ("three_month_average_volume", "last_volume", "regular_market_volume"):
                value = getattr(fast_info, key, None)
                if value is None and isinstance(fast_info, dict):
                    value = fast_info.get(key)
                normalized = self._normalize_volume(value)
                if normalized > 0:
                    return normalized

        info = ticker.info or {}
        for key in ("volume", "averageVolume", "averageDailyVolume10Day", "threeMonthAverageVolume"):
            normalized = self._normalize_volume(info.get(key))
            if normalized > 0:
                return normalized

        return 0

    def _is_market_open(self, *, is_inr: bool) -> bool:
        zone = pytz.timezone("Asia/Kolkata" if is_inr else "America/New_York")
        now = datetime.now(zone)
        if now.weekday() >= 5:
            return False
        if is_inr:
            return now.time() >= datetime.strptime("09:15", "%H:%M").time() and now.time() <= datetime.strptime("15:30", "%H:%M").time()
        return now.time() >= datetime.strptime("09:30", "%H:%M").time() and now.time() <= datetime.strptime("16:00", "%H:%M").time()

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

    def _get_quote_sync(self, symbol: str, *, is_inr: bool) -> dict:
        ticker = yf.Ticker(symbol)
        market_open = self._is_market_open(is_inr=is_inr)

        if market_open:
            intraday = ticker.history(period="1d", interval="1m", auto_adjust=False)
            if intraday is not None and not intraday.empty:
                daily = ticker.history(period="5d", interval="1d", auto_adjust=False)
                prev_close = 0.0
                if daily is not None and len(daily) >= 2:
                    prev_close = round(float(daily["Close"].iloc[-2]), 2)
                open_price = round(float(intraday["Open"].iloc[0]), 2)
                current_price = round(float(intraday["Close"].iloc[-1]), 2)
                high_price = round(float(intraday["High"].max()), 2)
                low_price = round(float(intraday["Low"].min()), 2)
                if prev_close == 0.0:
                    prev_close = open_price
                delta = current_price - prev_close
                delta_pct = (delta / prev_close) * 100 if prev_close else 0.0
                return {
                    "c": current_price,
                    "d": round(delta, 2),
                    "dp": round(delta_pct, 2),
                    "h": high_price,
                    "l": low_price,
                    "o": open_price,
                    "pc": prev_close,
                    "v": self._extract_volume(
                        ticker,
                        latest_volume=intraday["Volume"].iloc[-1]
                        if "Volume" in intraday
                        else None,
                    ),
                    "t": int(self._to_timestamp(intraday.index[-1])),
                }

        daily = ticker.history(period="5d", interval="1d", auto_adjust=False)
        if daily is not None and not daily.empty:
            latest = daily.iloc[-1]
            current_price = round(float(latest["Close"]), 2)
            prev_close = current_price
            if len(daily) >= 2:
                prev_close = round(float(daily["Close"].iloc[-2]), 2)
            delta = current_price - prev_close
            delta_pct = (delta / prev_close) * 100 if prev_close else 0.0
            return {
                "c": current_price,
                "d": round(delta, 2),
                "dp": round(delta_pct, 2),
                "h": round(float(latest["High"]), 2),
                "l": round(float(latest["Low"]), 2),
                "o": round(float(latest["Open"]), 2),
                "pc": prev_close,
                "v": self._extract_volume(
                    ticker,
                    latest_volume=latest.get("Volume"),
                ),
                "t": int(self._to_timestamp(daily.index[-1])),
            }

        info = ticker.info or {}
        if not info:
            return {}

        return {
            "c": round(float(info.get("currentPrice", info.get("regularMarketPrice", 0.0)) or 0.0), 2),
            "d": 0.0,
            "dp": 0.0,
            "h": round(float(info.get("dayHigh", 0.0) or 0.0), 2),
            "l": round(float(info.get("dayLow", 0.0) or 0.0), 2),
            "o": round(float(info.get("open", 0.0) or 0.0), 2),
            "pc": round(float(info.get("previousClose", 0.0) or 0.0), 2),
            "v": self._extract_volume(ticker, latest_volume=info.get("volume")),
            "t": int(datetime.now(timezone.utc).timestamp()),
        }

    async def get_quote(self, symbol: str, *, is_inr: bool = False) -> dict:
        candidates = self._inr_candidates(symbol) if is_inr else [symbol.upper().strip()]
        loop = asyncio.get_event_loop()
        for candidate in candidates:
            c = candidate
            quote = await loop.run_in_executor(
                _executor,
                lambda: self._get_quote_sync(c, is_inr=is_inr),
            )
            if quote and quote.get("c", 0.0) != 0.0:
                return quote
        return {}
