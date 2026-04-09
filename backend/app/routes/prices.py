from datetime import datetime, time as dtime, timedelta
import math

import pytz
import yfinance as yf
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

SYMBOLS = {
    "AMZN": {
        "name": "Amazon",
        "currency": "USD",
        "exchange": "NYSE",
        "yf_sym": "AMZN",
    },
    "NVDA": {
        "name": "NVIDIA",
        "currency": "USD",
        "exchange": "NYSE",
        "yf_sym": "NVDA",
    },
    "ITC": {
        "name": "ITC",
        "currency": "INR",
        "exchange": "NSE",
        "yf_sym": "ITC.NS",
    },
    "HDFCBANK": {
        "name": "HDFC Bank",
        "currency": "INR",
        "exchange": "NSE",
        "yf_sym": "HDFCBANK.NS",
    },
}


def is_nyse_open() -> bool:
    """NYSE: Mon-Fri 09:30-16:00 ET."""
    now = datetime.now(pytz.timezone("America/New_York"))
    if now.weekday() >= 5:
        return False
    return dtime(9, 30) <= now.time() <= dtime(16, 0)


def is_nse_open() -> bool:
    """NSE: Mon-Fri 09:15-15:30 IST."""
    now = datetime.now(pytz.timezone("Asia/Kolkata"))
    if now.weekday() >= 5:
        return False
    return dtime(9, 15) <= now.time() <= dtime(15, 30)


def _safe_float(value: object, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(number):
        return default
    return round(number, 2)


def _safe_pct_change(price: float, prev: float) -> float:
    if not prev or not math.isfinite(price) or not math.isfinite(prev):
        return 0.0
    return round(((price - prev) / prev) * 100, 2)


def get_accurate_price(yf_sym: str, market_open: bool) -> tuple[float, float]:
    """
    Returns (current_price, previous_close).
    - Market open  -> latest 1m candle close vs previous daily close.
    - Market closed -> last daily close vs prior daily close.
    """
    ticker = yf.Ticker(yf_sym)
    if market_open:
        hist = ticker.history(period="1d", interval="1m")
        if not hist.empty:
            price = _safe_float(hist["Close"].iloc[-1])
            daily = ticker.history(period="5d", interval="1d")
            if len(daily) >= 2:
                prev = _safe_float(daily["Close"].iloc[-2], default=price)
            else:
                prev = _safe_float(hist["Open"].iloc[0], default=price)
            return price, prev

    hist = ticker.history(period="5d", interval="1d")
    if len(hist) >= 2:
        return (
            _safe_float(hist["Close"].iloc[-1]),
            _safe_float(hist["Close"].iloc[-2]),
        )
    if len(hist) == 1:
        price = _safe_float(hist["Close"].iloc[-1])
        return price, price
    return 0.0, 0.0


_cache: list = []
_cache_ts: datetime = datetime.utcnow() - timedelta(seconds=60)


def build_response() -> list:
    results = []
    for sym, meta in SYMBOLS.items():
        exchange = meta["exchange"]
        market_open = is_nyse_open() if exchange == "NYSE" else is_nse_open()
        try:
            price, prev = get_accurate_price(meta["yf_sym"], market_open)
            chg = _safe_pct_change(price, prev)
            results.append(
                {
                    "sym": sym,
                    "name": meta["name"],
                    "currency": meta["currency"],
                    "exchange": exchange,
                    "price": price,
                    "prev": prev,
                    "chg": chg,
                    "up": chg >= 0,
                    "market_open": market_open,
                }
            )
        except Exception as error:
            results.append(
                {
                    "sym": sym,
                    "name": meta["name"],
                    "currency": meta["currency"],
                    "exchange": exchange,
                    "price": 0.0,
                    "prev": 0.0,
                    "chg": 0.0,
                    "up": True,
                    "market_open": market_open,
                    "error": str(error),
                }
            )
    return results


@router.get("/api/prices")
def get_prices() -> JSONResponse:
    global _cache, _cache_ts

    now = datetime.utcnow()
    if _cache and (now - _cache_ts).total_seconds() < 9:
        return JSONResponse(content=_cache)

    _cache = build_response()
    _cache_ts = now
    return JSONResponse(content=_cache)


INDICES = {
    "SENSEX":  "^BSESN",
    "NIFTY50": "^NSEI",
    "NASDAQ":  "^IXIC",
    "SP500":   "^GSPC",
    "USDINR":  "INR=X",
}

_index_cache:    list     = []
_index_cache_ts: datetime = datetime.utcnow() - timedelta(seconds=60)

@router.get("/api/indices")
def get_indices():
    global _index_cache, _index_cache_ts
    now = datetime.utcnow()
    if _index_cache and (now - _index_cache_ts).total_seconds() < 30:
        return JSONResponse(content=_index_cache)
    results = []
    for label, yf_sym in INDICES.items():
        try:
            t     = yf.Ticker(yf_sym)
            hist  = t.history(period="2d", interval="1d")
            if len(hist) >= 2:
                price = _safe_float(hist["Close"].iloc[-1])
                prev  = _safe_float(hist["Close"].iloc[-2], default=price)
            elif len(hist) == 1:
                price = _safe_float(hist["Close"].iloc[-1])
                prev  = price
            else:
                price, prev = 0.0, 0.0
            chg = _safe_pct_change(price, prev)
            results.append({
                "label": label,
                "price": price,
                "chg":   chg,
                "up":    chg >= 0,
            })
        except Exception:
            results.append({"label": label, "price": 0.0, "chg": 0.0, "up": True})
    _index_cache    = results
    _index_cache_ts = now
    return JSONResponse(content=results)
