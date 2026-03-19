"""
inference.py  —  replace your existing file at:
  backend/app/ml/inference.py

Changes from original:
  - _prepare_window now builds a (30, 6) feature matrix via features.py
  - LSTMStockModel.predict_sequence receives (30, 6) — no reshape to (30,1)
  - Baseline prediction logic is unchanged (kept as safety net)
  - Ensemble weights adjusted: 55% baseline / 45% LSTM (model is now stronger)
"""
from __future__ import annotations

from typing import Dict, List
from pathlib import Path

import numpy as np

from app.core.config import settings
from app.ml.features import build_feature_matrix, N_FEATURES


class PredictionEngine:
    def __init__(self) -> None:
        self._lstm_model = None
        # Pre-load model at startup to avoid first-request hang
        try:
            from app.ml.models.lstm_model import LSTMStockModel
            self._lstm_model = LSTMStockModel()
            print("[PredictionEngine] Model pre-loaded OK")
        except Exception as exc:
            print(f"[PredictionEngine] Pre-load failed: {exc}")
            self._lstm_model = "unavailable" 

    # ── feature preparation ───────────────────────────────────────────────────

    def _prepare_features(
        self,
        closes: np.ndarray,
        volumes: np.ndarray | None,
        window: int = 30,
    ) -> np.ndarray:
        """
        Returns a (window, N_FEATURES) float32 array ready for the model.
        If we have fewer than `window` closes we pad with the last value.
        """
        closes = np.ravel(closes).astype(float)

        # Pad closes if too short
        if closes.size < window:
            pad = np.full(window - closes.size, closes[0] if closes.size else 0.0)
            closes = np.concatenate([pad, closes])

        if volumes is not None:
            volumes = np.ravel(volumes).astype(float)
            if volumes.size < closes.size:
                volumes = np.pad(volumes, (closes.size - volumes.size, 0), constant_values=0.0)
        else:
            volumes = None

        # Build full feature matrix, then take last `window` rows
        matrix = build_feature_matrix(closes, volumes)   # (n, 6)
        return matrix[-window:]                           # (30, 6)

    # ── baseline (unchanged from original) ───────────────────────────────────

    def _baseline_prediction(self, series: np.ndarray) -> float:
        if series.size == 0:
            return 0.0
        last = float(series[-1])
        if series.size < 2:
            return last
        returns = np.diff(series) / series[:-1]
        window = min(30, returns.size)
        recent = returns[-window:] if window > 0 else returns
        if recent.size == 0:
            return last

        weights = np.linspace(0.4, 1.0, recent.size)
        weighted_mean = float(np.average(recent, weights=weights))

        closes_window = series[-(window + 1):] if series.size > window else series
        x = np.arange(closes_window.size, dtype=float)
        x_mean, y_mean = float(np.mean(x)), float(np.mean(closes_window))
        denom = float(np.sum((x - x_mean) ** 2))
        slope = float(np.sum((x - x_mean) * (closes_window - y_mean)) / denom) if denom else 0.0
        slope_return = slope / last if last else 0.0

        sma = float(np.mean(series[-min(20, series.size):]))
        mean_reversion = (sma - last) / last if last else 0.0

        blended = (0.55 * weighted_mean) + (0.25 * slope_return) + (0.20 * mean_reversion)
        vol = float(np.std(recent)) if recent.size else 0.0
        max_move = min(0.02, max(0.003, vol * 2.0))
        return last * (1 + float(np.clip(blended, -max_move, max_move)))

    def _sanitize_prediction(self, predicted: float, last: float, fallback: float, vol: float) -> float:
        if not np.isfinite(predicted) or predicted <= 0:
            return fallback
        max_move = min(0.05, max(0.003, vol * 3.0))
        if predicted < last * (1 - max_move) or predicted > last * (1 + max_move):
            return fallback
        return predicted

    # ── main prediction ───────────────────────────────────────────────────────

    def predict_next_price(
        self,
        closes: List[float],
        volumes: List[float] | None = None,
    ) -> Dict[str, float]:
        series = np.asarray(closes, dtype=float)
        if series.ndim > 1:
            series = np.ravel(series)
        if series.size == 0:
            raise ValueError("closes must contain at least one price")

        last = float(series[-1])
        baseline_pred = self._baseline_prediction(series)
        returns = np.diff(series) / series[:-1] if series.size > 1 else np.array([0.0])
        recent_returns = returns[-30:] if returns.size > 30 else returns
        vol = float(np.std(recent_returns)) if recent_returns.size > 0 else 0.0

        # Lazy-load LSTM
        if self._lstm_model is None and not settings.LOCAL_DATA_ONLY:
            try:
                model_path = Path(__file__).resolve().parent / "artifacts" / "lstm_stock_price.h5"
                if not model_path.exists():
                    raise FileNotFoundError("LSTM artifact missing — run train_lstm.py first")
                from app.ml.models.lstm_model import LSTMStockModel
                self._lstm_model = LSTMStockModel()
            except Exception as exc:
                print(f"[PredictionEngine] LSTM unavailable: {exc}")
                self._lstm_model = "unavailable"
        elif settings.LOCAL_DATA_ONLY:
            self._lstm_model = "unavailable"

        # Build 6-feature window
        vol_arr = np.asarray(volumes, dtype=float) if volumes else None
        feature_window = self._prepare_features(series, vol_arr, window=30)  # (30, 6)

        if self._lstm_model == "unavailable":
            lstm_pred = baseline_pred
        else:
            # predict_sequence now receives (30, 6) — see lstm_model.py update
            raw_pred = self._lstm_model.predict_sequence(feature_window) * last  # type: ignore
            lstm_pred = self._sanitize_prediction(raw_pred, last, baseline_pred, vol)

        # Ensemble: 55% baseline + 45% LSTM (model is stronger now)
        ensemble_pred = (0.40 * baseline_pred) + (0.60 * lstm_pred)

        expected_move = min(0.01, max(0.003, vol * 2.0))
        lower = last * (1 - expected_move)
        upper = last * (1 + expected_move)
        ensemble_pred = float(np.clip(ensemble_pred, lower, upper))

        return {
            "lstm": lstm_pred,
            "ensemble": ensemble_pred,
        }


prediction_engine = PredictionEngine()
