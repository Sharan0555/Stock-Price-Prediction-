"""
features.py  —  drop this file at:
  backend/app/ml/features.py

Builds a (N, 6) feature matrix from raw OHLCV data.
Features (all normalised to be scale-free):
  0  close_norm     close / close[-1]
  1  rsi_norm       RSI(14) / 100
  2  macd_norm      MACD line / close[-1]
  3  bb_pos         (close - BB_lower) / (BB_upper - BB_lower)  clamped [0,1]
  4  vol_ratio      volume / 20-period mean volume  (clamped 0-5)
  5  ema_slope      (EMA9 - EMA9[5 bars ago]) / close[-1]
"""
from __future__ import annotations
import numpy as np


# ── helpers ───────────────────────────────────────────────────────────────────

def _ema(series: np.ndarray, period: int) -> np.ndarray:
    """Exponential moving average — returns same length as input."""
    k = 2.0 / (period + 1)
    out = np.empty_like(series, dtype=float)
    out[0] = series[0]
    for i in range(1, len(series)):
        out[i] = series[i] * k + out[i - 1] * (1 - k)
    return out


def _rsi(closes: np.ndarray, period: int = 14) -> np.ndarray:
    """RSI — returns array of same length (first `period` values are filled with 50)."""
    deltas = np.diff(closes, prepend=closes[0])
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    avg_gain = np.empty_like(closes, dtype=float)
    avg_loss = np.empty_like(closes, dtype=float)

    # seed with simple mean
    avg_gain[period] = gains[1 : period + 1].mean()
    avg_loss[period] = losses[1 : period + 1].mean()
    for i in range(period + 1, len(closes)):
        avg_gain[i] = (avg_gain[i - 1] * (period - 1) + gains[i]) / period
        avg_loss[i] = (avg_loss[i - 1] * (period - 1) + losses[i]) / period

    # fill early values
    avg_gain[:period] = avg_gain[period]
    avg_loss[:period] = avg_loss[period]

    # Avoid evaluating avg_gain/avg_loss where avg_loss==0 (numpy warns before np.where applies).
    rs = np.divide(
        avg_gain,
        avg_loss,
        out=np.full_like(avg_gain, 100.0, dtype=float),
        where=(avg_loss != 0),
    )
    return 100.0 - (100.0 / (1.0 + rs))


def _bollinger(closes: np.ndarray, period: int = 20, num_std: float = 2.0):
    """Returns (upper, lower) band arrays of same length as closes."""
    upper = np.empty_like(closes, dtype=float)
    lower = np.empty_like(closes, dtype=float)
    for i in range(len(closes)):
        window = closes[max(0, i - period + 1) : i + 1]
        mu = window.mean()
        sigma = window.std()
        upper[i] = mu + num_std * sigma
        lower[i] = mu - num_std * sigma
    return upper, lower


# ── public API ────────────────────────────────────────────────────────────────

N_FEATURES = 6


def build_feature_matrix(
    closes: np.ndarray,
    volumes: np.ndarray | None = None,
) -> np.ndarray:
    """
    Parameters
    ----------
    closes  : 1-D float array, length >= 30
    volumes : 1-D float array same length as closes (optional).
              If None, vol_ratio feature is filled with 1.0.

    Returns
    -------
    matrix  : shape (len(closes), N_FEATURES)  — float32
    """
    closes = np.asarray(closes, dtype=float)
    n = len(closes)
    assert n >= 30, f"Need at least 30 closes, got {n}"

    if volumes is not None:
        volumes = np.asarray(volumes, dtype=float)
    else:
        volumes = np.ones(n, dtype=float)

    scale = closes[-1] if closes[-1] != 0 else 1.0

    # ── feature 0: normalised close ───────────────────────────────────────────
    close_norm = closes / scale

    # ── feature 1: RSI / 100 ─────────────────────────────────────────────────
    rsi_norm = _rsi(closes, period=14) / 100.0

    # ── feature 2: MACD line / scale ─────────────────────────────────────────
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    macd_norm = (ema12 - ema26) / scale

    # ── feature 3: Bollinger Band position [0, 1] ────────────────────────────
    bb_upper, bb_lower = _bollinger(closes, period=20)
    band_width = bb_upper - bb_lower
    band_width = np.where(band_width == 0, 1.0, band_width)
    bb_pos = np.clip((closes - bb_lower) / band_width, 0.0, 1.0)

    # ── feature 4: volume ratio (vol / 20-period mean vol) ───────────────────
    vol_ratio = np.empty(n, dtype=float)
    for i in range(n):
        window_v = volumes[max(0, i - 19) : i + 1]
        mean_v = window_v.mean()
        vol_ratio[i] = volumes[i] / mean_v if mean_v > 0 else 1.0
    vol_ratio = np.clip(vol_ratio, 0.0, 5.0)

    # ── feature 5: EMA-9 slope (change over 5 bars) / scale ─────────────────
    ema9 = _ema(closes, 9)
    ema_slope = np.empty(n, dtype=float)
    for i in range(n):
        ema_slope[i] = (ema9[i] - ema9[max(0, i - 5)]) / scale

    # ── stack ─────────────────────────────────────────────────────────────────
    matrix = np.stack(
        [close_norm, rsi_norm, macd_norm, bb_pos, vol_ratio, ema_slope],
        axis=1,
    ).astype(np.float32)

    return matrix  # shape (n, 6)


def make_windows(
    matrix: np.ndarray,
    closes: np.ndarray,
    window: int = 30,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Slice the feature matrix into (X, y) pairs for training.

    Returns
    -------
    X : shape (n_samples, window, N_FEATURES)
    y : shape (n_samples,)  — next close / last close in window (scale-free)
    """
    closes = np.asarray(closes, dtype=float)
    n = len(matrix)
    xs, ys = [], []
    for i in range(window, n):
        x_window = matrix[i - window : i]          # (window, 6)
        scale = closes[i - 1] if closes[i - 1] != 0 else 1.0
        y = closes[i] / scale
        xs.append(x_window)
        ys.append(y)
    return np.stack(xs).astype(np.float32), np.asarray(ys, dtype=np.float32)
