"""
train_lstm.py  —  replace your existing file at:
  backend/app/ml/train_lstm.py

Changes from original:
  - Imports yfinance to get OHLCV (not just closes)
  - Uses features.build_feature_matrix() → 6 features per timestep
  - Model input shape: (30, 6) instead of (30, 1)
  - Deeper architecture: LSTM(64) + LSTM(32) + Dense(16) + Dense(1)
  - Keeps your existing fallback chain (finnhub → alpha → local)
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
import time
from typing import Iterable, List

import numpy as np

from app.core.config import settings
from app.services.alpha_vantage_service import AlphaVantageService
from app.services.finnhub_service import FinnhubService
from app.services.local_data_service import LocalDataService
from app.ml.features import build_feature_matrix, make_windows, N_FEATURES


WINDOW = 30
MAX_SERIES_DAYS = 700

SYMBOLS: list[str] = [
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "TSLA",
    "META",
    "GOOGL",
    "JPM",
    "V",
    "RELIANCE.NS",
    "TCS.NS",
    "HDFCBANK.NS",
]


@dataclass
class SeriesResult:
    symbol: str
    closes: list[float]
    volumes: list[float]          # NEW — needed for vol_ratio feature
    source: str


def _looks_like_inr(symbol: str) -> bool:
    sym = symbol.upper()
    return sym.endswith(".NS") or sym.endswith(".NSE") or sym.endswith(".BSE") or sym.endswith(".BO")


def _alpha_candidates(symbol: str) -> list[str]:
    sym = symbol.upper()
    if sym.endswith(".NS"):
        return [sym.replace(".NS", ".NSE")]
    if sym.endswith(".BO"):
        return [sym.replace(".BO", ".BSE")]
    if "." in sym:
        return [sym]
    suffixes: list[str] = []
    primary = settings.ALPHAVANTAGE_INR_SUFFIX or ""
    if primary:
        suffixes.append(primary)
    for extra in (".BSE", ".NSE"):
        if extra and extra not in suffixes:
            suffixes.append(extra)
    if not suffixes:
        return [sym]
    return [f"{sym}{suffix}" for suffix in suffixes]


def _extract_ohlcv(series: list[dict]) -> tuple[list[float], list[float]]:
    closes, volumes = [], []
    for point in series:
        c = point.get("c", 0.0)
        v = point.get("v", 0.0)
        if c and float(c) > 0:
            closes.append(float(c))
            volumes.append(float(v) if v else 0.0)
    return closes, volumes


def _fetch_finnhub_series(service: FinnhubService, symbol: str, days: int) -> tuple[list[float], list[float]]:
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    data = service.get_candles(symbol, "D", int(start.timestamp()), int(now.timestamp()))
    if data.get("s") != "ok" or not data.get("c"):
        raise ValueError("Finnhub returned empty candles")
    closes = [float(v) for v in data["c"] if v]
    volumes = [float(v) for v in data.get("v", [0] * len(closes))]
    return closes, volumes


def _fetch_yfinance_series(symbol: str, days: int) -> tuple[list[float], list[float]]:
    """Primary source — no API key, gets both closes and volumes."""
    import yfinance as yf
    period = "2y" if days > 365 else "1y"
    df = yf.Ticker(symbol).history(period=period)
    if df.empty:
        raise ValueError(f"yfinance returned no data for {symbol}")
    closes = df["Close"].tolist()
    volumes = df["Volume"].tolist()
    return closes, volumes


def _fetch_alpha_series(service, symbol: str) -> tuple[list[float], list[float]]:
    series = service.get_daily_series(symbol, output_size="full")
    return _extract_ohlcv(series)


def _load_series(
    symbol: str,
    finnhub: FinnhubService,
    alpha: AlphaVantageService,
    local_data: LocalDataService,
) -> SeriesResult | None:
    is_inr = _looks_like_inr(symbol)
    currency = "INR" if is_inr else "USD"

    # ── 1. Try yfinance first (no key, gets volume too) ───────────────────────
    try:
        closes, volumes = _fetch_yfinance_series(symbol, MAX_SERIES_DAYS)
        if len(closes) >= WINDOW + 1:
            print(f"  {symbol}: yfinance OK ({len(closes)} bars)")
            return SeriesResult(symbol, closes[-MAX_SERIES_DAYS:], volumes[-MAX_SERIES_DAYS:], "yfinance")
    except Exception as exc:
        print(f"  {symbol}: yfinance failed ({exc}), trying fallbacks")

    # ── 2. Finnhub (USD only) ─────────────────────────────────────────────────
    if not is_inr and settings.FINNHUB_API_KEY:
        try:
            closes, volumes = _fetch_finnhub_series(finnhub, symbol, MAX_SERIES_DAYS)
            if len(closes) >= WINDOW + 1:
                return SeriesResult(symbol, closes[-MAX_SERIES_DAYS:], volumes[-MAX_SERIES_DAYS:], "finnhub")
        except Exception:
            pass

    # ── 3. Alpha Vantage ──────────────────────────────────────────────────────
    if settings.ALPHAVANTAGE_API_KEY:
        candidates = _alpha_candidates(symbol) if is_inr else [symbol]
        for candidate in candidates:
            try:
                closes, volumes = _fetch_alpha_series(alpha, candidate)
                if len(closes) >= WINDOW + 1:
                    return SeriesResult(symbol, closes[-MAX_SERIES_DAYS:], volumes[-MAX_SERIES_DAYS:], "alpha_vantage")
            except Exception as exc:
                msg = str(exc)
                if "rate limit" in msg.lower() or "Thank you for using Alpha Vantage" in msg:
                    time.sleep(65)
                continue

    # ── 4. Local fallback (no volume data available) ──────────────────────────
    raw = local_data.get_series(symbol, currency, days=MAX_SERIES_DAYS)
    closes, volumes = _extract_ohlcv(raw)
    if len(closes) >= WINDOW + 1:
        return SeriesResult(symbol, closes[-MAX_SERIES_DAYS:], [0.0] * len(closes), "local")

    return None


def _build_dataset(series_list: Iterable[SeriesResult]) -> tuple[np.ndarray, np.ndarray]:
    all_x: list[np.ndarray] = []
    all_y: list[np.ndarray] = []

    for result in series_list:
        closes = np.asarray(result.closes, dtype=float)
        volumes = np.asarray(result.volumes, dtype=float)

        if closes.size < WINDOW + 1:
            continue

        try:
            matrix = build_feature_matrix(closes, volumes)   # (n, 6)
            x, y = make_windows(matrix, closes, window=WINDOW)
            all_x.append(x)
            all_y.append(y)
        except Exception as exc:
            print(f"  Skipping {result.symbol} — feature build failed: {exc}")
            continue

    if not all_x:
        raise RuntimeError("No training windows available; check data sources.")

    return np.concatenate(all_x, axis=0), np.concatenate(all_y, axis=0)


def train_model() -> Path:
    from tensorflow import keras  # type: ignore

    finnhub = FinnhubService()
    alpha = AlphaVantageService()
    local_data = LocalDataService()

    series_results: list[SeriesResult] = []
    for symbol in SYMBOLS:
        result = _load_series(symbol, finnhub, alpha, local_data)
        if result:
            print(f"Loaded {result.symbol} from {result.source}: {len(result.closes)} closes")
            series_results.append(result)
        else:
            print(f"Skipped {symbol}: insufficient data")

    x, y = _build_dataset(series_results)
    print(f"\nDataset: {x.shape[0]} samples, input shape {x.shape[1:]}")  # (n, 30, 6)

    rng = np.random.default_rng(42)
    idx = rng.permutation(len(x))
    x, y = x[idx], y[idx]

    split = int(len(x) * 0.9)
    x_train, x_val = x[:split], x[split:]
    y_train, y_val = y[:split], y[split:]

    # ── Model: deeper, wider, takes (30, 6) input ─────────────────────────────
    model = keras.Sequential([
        keras.layers.Input(shape=(WINDOW, N_FEATURES)),
        keras.layers.LSTM(64, return_sequences=True, dropout=0.1),
        keras.layers.LSTM(32, dropout=0.1),
        keras.layers.Dense(16, activation="relu"),
        keras.layers.Dense(1),
    ])
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss=keras.losses.Huber(),
        metrics=[keras.metrics.MeanAbsolutePercentageError()],
    )
    model.summary()

    model.fit(
        x_train, y_train,
        validation_data=(x_val, y_val) if len(x_val) else None,
        epochs=30,
        batch_size=64,
        callbacks=[
            keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, verbose=1),
        ],
        verbose=1,
    )

    artifacts_dir = Path(__file__).resolve().parent / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    model_path = artifacts_dir / "lstm_stock_price.h5"
    model.save(model_path)
    print(f"\nSaved model → {model_path}")
    return model_path


if __name__ == "__main__":
    trained_path = train_model()
    print(f"Training complete: {trained_path}")
