from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path
from typing import Literal

import numpy as np

from app.ml.features import N_FEATURES
from app.ml.inference import prediction_engine


def build_lstm_model():
    from tensorflow import keras  # type: ignore

    model = keras.Sequential(
        [
            keras.layers.Input(shape=(30, N_FEATURES)),
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


class ModelTrainer:
    def predict(
        self,
        closes: Sequence[float],
        volumes: Sequence[float] | None = None,
        symbol: str | None = None,
    ) -> dict[str, float]:
        result = prediction_engine.predict_next_price(
            list(closes),
            list(volumes) if volumes is not None else None,
            symbol=symbol,
        )
        # Round all values except signal which is a string
        rounded_result = {}
        for key, value in result.items():
            if key == "signal":
                rounded_result[key] = value
            else:
                rounded_result[key] = round(float(value), 4)
        return rounded_result

    def compute_risk_profile(
        self,
        closes: Sequence[float],
        predicted: float,
        signal: str | None = None,
    ) -> dict[str, float | str]:
        arr = np.asarray(list(closes), dtype=float)
        if arr.size == 0:
            raise ValueError("closes must contain at least one price")

        last_price = float(arr[-1])
        returns = np.diff(arr) / arr[:-1] if arr.size > 1 else np.array([0.0])
        vol = float(np.std(returns)) if returns.size > 0 else 0.0
        score = max(0.0, min(100.0, vol * 1000.0))

        if score < 25:
            level: Literal["low", "medium", "high"] = "low"
        elif score < 60:
            level = "medium"
        else:
            level = "high"

        change_pct = (predicted - last_price) / last_price * 100 if last_price else 0.0
        
        # Use provided corrected signal, or compute if not available
        if signal is None:
            trend_pct = 0.0
            if arr.size >= 15 and arr[-15] != 0:
                trend_pct = float((arr[-1] - arr[-15]) / arr[-15] * 100)

            if trend_pct >= 0.75 or (change_pct >= 0.35 and level != "high"):
                signal: Literal["BUY", "HOLD", "SELL"] = "BUY"
            elif trend_pct <= -0.75 or (change_pct <= -0.35 and level == "high"):
                signal = "SELL"
            else:
                signal = "HOLD"
        else:
            # Use the corrected signal provided by the prediction engine
            # Ensure it's a valid signal
            if signal not in ["BUY", "HOLD", "SELL"]:
                signal = "HOLD"

        return {
            "score": round(score, 2),
            "level": level,
            "signal": signal,
            "last_price": round(last_price, 2),
            "change_pct": round(change_pct, 2),
        }

    def train(self, ticker: str = "GLOBAL") -> Path:
        from app.ml.train_lstm import train_model

        return train_model(ticker=ticker)
