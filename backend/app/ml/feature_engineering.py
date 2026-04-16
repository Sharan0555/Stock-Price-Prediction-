from __future__ import annotations

from collections.abc import Sequence

import numpy as np
import pandas as pd

FEATURE_COLS = [
    "close",
    "rsi",
    "macd",
    "macd_signal",
    "macd_hist",
    "bb_pct",
    "bb_upper",
    "bb_lower",
    "atr",
    "obv",
    "vwap",
    "vol_ratio",
    "returns_1d",
    "returns_5d",
]


def _as_series(values: Sequence[float] | pd.Series) -> pd.Series:
    return pd.Series(values, copy=False, dtype="float64")


def compute_rsi(close: Sequence[float] | pd.Series, period: int = 14) -> pd.Series:
    close_series = _as_series(close)
    delta = close_series.diff()
    gains = delta.clip(lower=0.0)
    losses = -delta.clip(upper=0.0)

    avg_gain = gains.ewm(com=period - 1, adjust=False, min_periods=period).mean()
    avg_loss = losses.ewm(com=period - 1, adjust=False, min_periods=period).mean()
    rs = avg_gain.div(avg_loss.replace(0.0, np.nan))
    rsi = 100 - (100 / (1 + rs))

    rsi = rsi.where(avg_loss != 0, 100.0)
    rsi = rsi.where(~((avg_gain == 0) & (avg_loss == 0)), 50.0)
    return rsi.fillna(50.0)


def compute_macd(
    close: Sequence[float] | pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal: int = 9,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    close_series = _as_series(close)
    fast_ema = close_series.ewm(span=fast, adjust=False).mean()
    slow_ema = close_series.ewm(span=slow, adjust=False).mean()
    macd = fast_ema - slow_ema
    signal_line = macd.ewm(span=signal, adjust=False).mean()
    histogram = macd - signal_line
    return macd, signal_line, histogram


def compute_bollinger(
    close: Sequence[float] | pd.Series,
    period: int = 20,
    num_std: float = 2.0,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    close_series = _as_series(close)
    mid = close_series.rolling(window=period, min_periods=period).mean()
    std = close_series.rolling(window=period, min_periods=period).std(ddof=0)
    upper = mid + (num_std * std)
    lower = mid - (num_std * std)
    return upper, mid, lower


def compute_atr(
    high: Sequence[float] | pd.Series,
    low: Sequence[float] | pd.Series,
    close: Sequence[float] | pd.Series,
    period: int = 14,
) -> pd.Series:
    high_series = _as_series(high)
    low_series = _as_series(low)
    close_series = _as_series(close)
    prev_close = close_series.shift(1)

    true_range = pd.concat(
        [
            high_series - low_series,
            (high_series - prev_close).abs(),
            (low_series - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return true_range.ewm(com=period - 1, adjust=False, min_periods=period).mean()


def compute_obv(
    close: Sequence[float] | pd.Series,
    volume: Sequence[float] | pd.Series,
) -> pd.Series:
    close_series = _as_series(close)
    volume_series = _as_series(volume).fillna(0.0)
    signed_volume = close_series.diff().apply(np.sign).fillna(0.0) * volume_series
    return signed_volume.cumsum()


def compute_vwap(
    high: Sequence[float] | pd.Series,
    low: Sequence[float] | pd.Series,
    close: Sequence[float] | pd.Series,
    volume: Sequence[float] | pd.Series,
) -> pd.Series:
    high_series = _as_series(high)
    low_series = _as_series(low)
    close_series = _as_series(close)
    volume_series = _as_series(volume).fillna(0.0)
    typical_price = (high_series + low_series + close_series) / 3.0
    cumulative_volume = volume_series.cumsum().replace(0.0, np.nan)
    vwap = (typical_price * volume_series).cumsum().div(cumulative_volume)
    return vwap.fillna(close_series)


def _coerce_ohlcv_frame(df: pd.DataFrame | Sequence[dict]) -> pd.DataFrame:
    frame = pd.DataFrame(df).copy()
    if frame.empty:
        return pd.DataFrame(columns=["t", "open", "high", "low", "close", "volume"])

    frame = frame.rename(
        columns={
            "o": "open",
            "h": "high",
            "l": "low",
            "c": "close",
            "v": "volume",
        }
    )

    for column in ("open", "high", "low", "close", "volume"):
        if column not in frame:
            frame[column] = np.nan

    if "t" in frame:
        frame = frame.sort_values("t").reset_index(drop=True)
    else:
        frame = frame.reset_index(drop=True)

    for column in ("open", "high", "low", "close", "volume"):
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    frame["close"] = frame["close"].ffill().bfill()
    frame["open"] = frame["open"].fillna(frame["close"])
    frame["high"] = frame["high"].fillna(frame[["open", "close"]].max(axis=1))
    frame["low"] = frame["low"].fillna(frame[["open", "close"]].min(axis=1))
    frame["volume"] = frame["volume"].fillna(0.0).clip(lower=0.0)

    return frame.dropna(subset=["close"]).reset_index(drop=True)


def add_technical_indicators(df: pd.DataFrame | Sequence[dict]) -> pd.DataFrame:
    frame = _coerce_ohlcv_frame(df)
    if frame.empty:
        return frame

    upper, mid, lower = compute_bollinger(frame["close"])
    macd, macd_signal, macd_hist = compute_macd(frame["close"])

    frame["rsi"] = compute_rsi(frame["close"])
    frame["macd"] = macd
    frame["macd_signal"] = macd_signal
    frame["macd_hist"] = macd_hist
    frame["bb_upper"] = upper
    frame["bb_mid"] = mid
    frame["bb_lower"] = lower

    band_width = (upper - lower).replace(0.0, np.nan)
    frame["bb_pct"] = (frame["close"] - lower).div(band_width).fillna(0.5)
    frame["atr"] = compute_atr(frame["high"], frame["low"], frame["close"])
    frame["obv"] = compute_obv(frame["close"], frame["volume"])
    frame["vwap"] = compute_vwap(
        frame["high"],
        frame["low"],
        frame["close"],
        frame["volume"],
    )

    volume_mean = frame["volume"].rolling(window=20, min_periods=20).mean()
    frame["vol_ratio"] = frame["volume"].div(volume_mean.replace(0.0, np.nan))
    frame["returns_1d"] = frame["close"].pct_change(1)
    frame["returns_5d"] = frame["close"].pct_change(5)

    return frame.dropna().reset_index(drop=True)


def build_feature_matrix(
    df: pd.DataFrame | Sequence[dict],
    seq_len: int = 60,
    target_col: str = "close",
) -> tuple[np.ndarray, np.ndarray, dict[str, tuple[float, float]]]:
    frame = (
        add_technical_indicators(df)
        if not set(FEATURE_COLS).issubset(pd.DataFrame(df).columns)
        else pd.DataFrame(df).copy()
    )
    if frame.empty or len(frame) <= seq_len:
        raise ValueError("Not enough rows to build feature windows")
    if target_col not in frame:
        raise KeyError(f"Unknown target column: {target_col}")

    scalers: dict[str, tuple[float, float]] = {}
    scaled = frame.copy()
    for column in FEATURE_COLS:
        values = pd.to_numeric(scaled[column], errors="coerce")
        min_value = float(values.min())
        max_value = float(values.max())
        scalers[column] = (min_value, max_value)
        if np.isclose(max_value, min_value):
            scaled[column] = 0.0
        else:
            scaled[column] = (values - min_value) / (max_value - min_value)

    x_rows: list[np.ndarray] = []
    y_rows: list[float] = []
    for index in range(seq_len, len(scaled)):
        x_rows.append(scaled[FEATURE_COLS].iloc[index - seq_len:index].to_numpy(dtype=np.float32))
        y_rows.append(float(scaled[target_col].iloc[index]))

    return np.asarray(x_rows, dtype=np.float32), np.asarray(y_rows, dtype=np.float32), scalers


def inverse_scale(
    value: float,
    col: str,
    scalers: dict[str, tuple[float, float]],
) -> float:
    min_value, max_value = scalers[col]
    if np.isclose(max_value, min_value):
        return float(min_value)
    return float(value * (max_value - min_value) + min_value)


class FeatureEngineeringService:
    def build_frame(self, series: Sequence[dict]) -> pd.DataFrame:
        return _coerce_ohlcv_frame(series)

    def summarize_indicators(self, series: Sequence[dict]) -> dict[str, float | str | None]:
        frame = self.build_frame(series)
        if frame.empty:
            return {
                "rsi14": None,
                "macd": None,
                "macd_signal": None,
                "ema9": None,
                "ema21": None,
                "sma20": None,
                "volatility20": None,
                "trend": "neutral",
            }

        close = frame["close"]
        ema9 = close.ewm(span=9, adjust=False).mean()
        ema21 = close.ewm(span=21, adjust=False).mean()
        sma20 = close.rolling(window=20, min_periods=1).mean()
        volatility20 = close.pct_change().rolling(window=20, min_periods=2).std().iloc[-1]
        macd, macd_signal, _ = compute_macd(close)
        rsi = compute_rsi(close, period=14)

        last_close = float(close.iloc[-1])
        ema9_last = float(ema9.iloc[-1])
        ema21_last = float(ema21.iloc[-1])
        trend = "neutral"
        if last_close >= ema9_last >= ema21_last:
            trend = "bullish"
        elif last_close <= ema9_last <= ema21_last:
            trend = "bearish"

        rsi_last = rsi.iloc[-1]
        macd_last = macd.iloc[-1]
        signal_last = macd_signal.iloc[-1]

        return {
            "rsi14": round(float(rsi_last), 2) if pd.notna(rsi_last) else None,
            "macd": round(float(macd_last), 4) if pd.notna(macd_last) else None,
            "macd_signal": (
                round(float(signal_last), 4) if pd.notna(signal_last) else None
            ),
            "ema9": round(ema9_last, 2),
            "ema21": round(ema21_last, 2),
            "sma20": round(float(sma20.iloc[-1]), 2),
            "volatility20": (
                round(float(volatility20) * 100, 2)
                if pd.notna(volatility20)
                else None
            ),
            "trend": trend,
        }
