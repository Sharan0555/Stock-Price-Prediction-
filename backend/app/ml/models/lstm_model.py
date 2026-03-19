"""
lstm_model.py  —  replace your existing file at:
  backend/app/ml/models/lstm_model.py

Changes from original:
  - Input shape: (30, 6) instead of (30, 1)
  - predict_sequence accepts a (30, 6) array directly — no reshaping to (30,1)
  - Dummy model also uses (30, 6) so shape always matches
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from app.ml.features import N_FEATURES

MODEL_DIR = Path(__file__).resolve().parent.parent / "artifacts"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
MODEL_PATH = MODEL_DIR / "lstm_stock_price.h5"

WINDOW = 30


class LSTMStockModel:
    def __init__(self) -> None:
        """
        Try to load a real TensorFlow/Keras model if the environment supports it.
        If TensorFlow or its binary dependencies are missing/incompatible, fall
        back to a lightweight NumPy-based dummy model so imports still succeed.
        """
        try:
            from tensorflow import keras  # type: ignore
        except Exception as exc:  # pragma: no cover - environment-dependent
            print(
                "[LSTMStockModel] TensorFlow unavailable, using NumPy dummy model:",
                exc,
            )
            self._keras = None  # type: ignore[assignment]
            self.model = self._build_numpy_dummy_model()
            return

        self._keras = keras

        if MODEL_PATH.exists():
            self.model = keras.models.load_model(MODEL_PATH)
        else:
            print(
                "[LSTMStockModel] No artifact found — using small Keras dummy. "
                "Run train_lstm.py to generate a real model.",
            )
            self.model = self._build_keras_dummy_model()

    def _build_keras_dummy_model(self):
        keras = self._keras
        inputs = keras.Input(shape=(WINDOW, N_FEATURES))   # (30, 6)
        x = keras.layers.LSTM(32)(inputs)
        outputs = keras.layers.Dense(1)(x)
        model = keras.Model(inputs=inputs, outputs=outputs)
        model.compile(optimizer="adam", loss="mse")
        return model

    def _build_numpy_dummy_model(self):
        """
        Very small stand‑in model that operates purely in NumPy.

        It looks at the last timestep's features and produces a smooth ratio
        close to 1.0, nudged slightly by trend features so predictions remain
        stable and fast even without TensorFlow installed.
        """

        class _NumpyModel:
            def predict(self, window: np.ndarray, verbose: int = 0) -> np.ndarray:
                arr = np.asarray(window, dtype=np.float32)
                if arr.ndim == 2:
                    arr = arr[np.newaxis, ...]  # (1, 30, 6)

                last_step = arr[:, -1, :]  # (batch, 6)
                close_norm = last_step[:, 0]
                macd = last_step[:, 2]
                ema_slope = last_step[:, 5]

                # Base ratio near 1, gently adjusted by features
                ratio = 1.0 + 0.02 * ema_slope + 0.01 * macd
                # Ensure we stay within a tight band around 1
                ratio = np.clip(ratio, 0.97, 1.03)

                # Keep interface compatible with Keras.predict → (batch, 1)
                return ratio.reshape(-1, 1)

        return _NumpyModel()

    def predict_sequence(self, feature_window: np.ndarray) -> float:
        """
        Parameters
        ----------
        feature_window : np.ndarray  shape (30, 6)
            Output of features._prepare_features() — already normalised.

        Returns
        -------
        float — predicted next close expressed as a ratio to closes[-1].
                 Caller multiplies by last close to get the price.
        """
        # Ensure shape is (1, 30, 6) for batch inference
        window = np.asarray(feature_window, dtype=np.float32)
        if window.ndim == 2:
            window = window[np.newaxis, ...]   # (1, 30, 6)

        preds: Any = self.model.predict(window, verbose=0)
        return float(preds[0, 0])
