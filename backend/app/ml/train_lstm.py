from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

import numpy as np

from app.core.config import settings
from app.ml.features import N_FEATURES, build_feature_matrix, make_windows
from app.services.alpha_vantage_service import AlphaVantageService
from app.services.finnhub_service import FinnhubService
from app.services.local_data_service import LocalDataService
from app.services.yfinance_service import YFinanceService

WINDOW = 30
MAX_SERIES_DAYS = 400
TRAIN_EPOCHS = 3
DEFAULT_SYMBOLS: list[str] = [
    "AAPL",
    "TSLA",
    "GOOGL",
    "MSFT",
]


@dataclass
class SeriesResult:
    symbol: str
    closes: list[float]
    volumes: list[float]
    source: str


def _looks_like_inr(symbol: str) -> bool:
    sym = symbol.upper()
    return sym.endswith((".NS", ".NSE", ".BO", ".BSE"))


def _alpha_candidates(symbol: str) -> list[str]:
    sym = symbol.upper()
    if sym.endswith(".NS"):
        return [sym.replace(".NS", ".NSE")]
    if sym.endswith(".BO"):
        return [sym.replace(".BO", ".BSE")]
    return [sym]


def _extract_ohlcv(series: list[dict]) -> tuple[list[float], list[float]]:
    closes: list[float] = []
    volumes: list[float] = []
    for point in series:
        close = point.get("c")
        if close is None:
            continue
        close_value = float(close)
        if close_value <= 0:
            continue
        closes.append(close_value)
        volume = point.get("v")
        volumes.append(float(volume) if volume is not None else 0.0)
    return closes, volumes


def _build_lstm_model():
    from tensorflow import keras  # type: ignore

    model = keras.Sequential(
        [
            keras.layers.Input(shape=(WINDOW, N_FEATURES)),
            keras.layers.LSTM(64, return_sequences=True, dropout=0.1),
            keras.layers.LSTM(32, dropout=0.1),
            keras.layers.Dense(16, activation="relu"),
            keras.layers.Dense(1),
        ]
    )
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss=keras.losses.Huber(),
        metrics=[keras.metrics.MeanAbsolutePercentageError()],
    )
    return model


def _fetch_finnhub_series(
    service: FinnhubService,
    symbol: str,
    days: int,
) -> tuple[list[float], list[float]]:
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    data = asyncio.run(
        service.get_candles(
            symbol,
            "D",
            int(start.timestamp()),
            int(now.timestamp()),
        )
    )
    if data.get("s") != "ok" or not data.get("c"):
        raise ValueError("Finnhub returned empty candles")

    series: list[dict] = []
    for index, close in enumerate(data.get("c", [])):
        if close is None:
            continue
        series.append(
            {
                "t": int(data.get("t", [0])[index]),
                "o": float(data.get("o", [close])[index]),
                "h": float(data.get("h", [close])[index]),
                "l": float(data.get("l", [close])[index]),
                "c": float(close),
                "v": float(data.get("v", [0])[index]),
            }
        )
    return _extract_ohlcv(series)


def _fetch_alpha_series(service: AlphaVantageService, symbol: str) -> tuple[list[float], list[float]]:
    return _extract_ohlcv(service.get_daily_series(symbol, output_size="full"))


def _build_cv_scores(closes: list[float], folds: int = 3) -> list[dict[str, float | int]]:
    series = np.asarray(closes, dtype=float)
    if series.size < WINDOW + (folds * 12):
        return []

    available = series.size - WINDOW
    fold_size = max(10, available // (folds + 1))
    scores: list[dict[str, float | int]] = []

    for fold_index in range(folds):
        train_end = min(WINDOW + fold_size * (fold_index + 1), series.size - 1)
        validation_end = min(train_end + fold_size, series.size)
        actual = series[train_end:validation_end]
        predicted = series[train_end - 1 : validation_end - 1]

        if actual.size == 0 or predicted.size == 0:
            continue

        errors = predicted - actual
        mae = float(np.mean(np.abs(errors)))
        rmse = float(np.sqrt(np.mean(np.square(errors))))
        non_zero_actual = np.where(actual == 0, np.nan, actual)
        mape = float(np.nanmean(np.abs(errors) / non_zero_actual) * 100)

        scores.append(
            {
                "fold": fold_index + 1,
                "train_size": int(train_end),
                "validation_size": int(actual.size),
                "mae": round(mae, 4),
                "rmse": round(rmse, 4),
                "mape": round(0.0 if np.isnan(mape) else mape, 4),
            }
        )

    return scores


def _load_series(
    symbol: str,
    yfinance: YFinanceService,
    finnhub: FinnhubService,
    alpha: AlphaVantageService,
    local_data: LocalDataService,
) -> SeriesResult | None:
    normalized = symbol.upper()
    is_inr = _looks_like_inr(normalized)
    currency = "INR" if is_inr else "USD"

    try:
        raw = yfinance.get_daily_ohlcv_sync(normalized, MAX_SERIES_DAYS, is_inr=is_inr)
        closes, volumes = _extract_ohlcv(raw)
        if len(closes) >= WINDOW + 1:
            return SeriesResult(normalized, closes[-MAX_SERIES_DAYS:], volumes[-MAX_SERIES_DAYS:], "yfinance")
    except Exception:
        pass

    if not is_inr and settings.FINNHUB_API_KEY:
        try:
            closes, volumes = _fetch_finnhub_series(finnhub, normalized, MAX_SERIES_DAYS)
            if len(closes) >= WINDOW + 1:
                return SeriesResult(normalized, closes[-MAX_SERIES_DAYS:], volumes[-MAX_SERIES_DAYS:], "finnhub")
        except Exception:
            pass

    if settings.ALPHAVANTAGE_API_KEY:
        for candidate in _alpha_candidates(normalized):
            try:
                closes, volumes = _fetch_alpha_series(alpha, candidate)
                if len(closes) >= WINDOW + 1:
                    return SeriesResult(normalized, closes[-MAX_SERIES_DAYS:], volumes[-MAX_SERIES_DAYS:], "alpha_vantage")
            except Exception:
                continue

    raw = local_data.get_series(normalized, currency, days=MAX_SERIES_DAYS)
    closes, _ = _extract_ohlcv(raw)
    if len(closes) >= WINDOW + 1:
        return SeriesResult(
            normalized,
            closes[-MAX_SERIES_DAYS:],
            [0.0] * min(len(closes), MAX_SERIES_DAYS),
            "local",
        )

    return None


def _build_dataset(series_list: Iterable[SeriesResult]) -> tuple[np.ndarray, np.ndarray]:
    all_x: list[np.ndarray] = []
    all_y: list[np.ndarray] = []

    for result in series_list:
        closes = np.asarray(result.closes, dtype=float)
        volumes = np.asarray(result.volumes, dtype=float)
        if closes.size < WINDOW + 1:
            continue

        matrix = build_feature_matrix(closes, volumes)
        x, y = make_windows(matrix, closes, window=WINDOW)
        all_x.append(x)
        all_y.append(y)

    if not all_x:
        raise RuntimeError("No training windows available for model training")

    return np.concatenate(all_x, axis=0), np.concatenate(all_y, axis=0)


def train_model(ticker: str = "GLOBAL") -> Path:
    from app.ml.model_registry import MODELS_DIR, register, save

    tickers = DEFAULT_SYMBOLS if ticker.upper() == "GLOBAL" else [ticker.upper()]
    yfinance = YFinanceService()
    finnhub = FinnhubService()
    alpha = AlphaVantageService()
    local_data = LocalDataService()

    series_results: list[SeriesResult] = []
    for symbol in tickers:
        result = _load_series(symbol, yfinance, finnhub, alpha, local_data)
        if result is None:
            raise RuntimeError(f"Unable to load enough data to train {symbol}")
        series_results.append(result)

    x, y = _build_dataset(series_results)

    rng = np.random.default_rng(42)
    order = rng.permutation(len(x))
    x = x[order]
    y = y[order]

    split = max(int(len(x) * 0.85), 1)
    split = min(split, len(x))
    x_train, y_train = x[:split], y[:split]
    x_val, y_val = x[split:], y[split:]

    model = _build_lstm_model()

    callbacks = []
    try:
        from tensorflow import keras  # type: ignore

        monitor = "val_loss" if len(x_val) else "loss"
        callbacks.append(
            keras.callbacks.EarlyStopping(
                monitor=monitor,
                patience=2,
                restore_best_weights=True,
            )
        )
    except Exception:
        callbacks = []

    fit_kwargs = {
        "x": x_train,
        "y": y_train,
        "epochs": TRAIN_EPOCHS,
        "batch_size": min(32, max(len(x_train), 1)),
        "verbose": 0,
        "shuffle": False,
    }
    if len(x_val):
        fit_kwargs["validation_data"] = (x_val, y_val)
    if callbacks:
        fit_kwargs["callbacks"] = callbacks

    model.fit(**fit_kwargs)

    cv_scores = _build_cv_scores(series_results[0].closes) if len(series_results) == 1 else []
    model_key = ticker.upper()
    register(model_key, model, {}, cv_scores)
    save(model_key)
    return MODELS_DIR / f"{model_key}.keras"


if __name__ == "__main__":
    path = train_model()
    print(f"Training complete: {path}")
