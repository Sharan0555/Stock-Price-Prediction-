from __future__ import annotations

from collections.abc import Sequence
from typing import Any

try:
    from transformers import pipeline
except Exception:  # pragma: no cover - optional dependency fallback
    pipeline = None

try:
    import torch
except Exception:  # pragma: no cover - optional dependency fallback
    torch = None


class SentimentService:
    MODEL_ID = "ProsusAI/finbert"

    def __init__(self) -> None:
        self._classifier: Any | None = None
        self._model_loaded = False
        self._load_attempted = False
        self._device = "unavailable"

    def _resolve_device(self) -> str:
        if torch is None:
            return "cpu"
        if torch.cuda.is_available():
            return "cuda"
        mps_backend = getattr(torch.backends, "mps", None)
        if mps_backend is not None and mps_backend.is_available():
            return "mps"
        return "cpu"

    def _load_finbert(self):
        if self._classifier is not None:
            return self._classifier
        if self._load_attempted:
            return None

        self._load_attempted = True
        if pipeline is None:
            self._device = "unavailable"
            return None
        try:
            self._classifier = pipeline(
                "text-classification",
                model=self.MODEL_ID,
                tokenizer=self.MODEL_ID,
            )
            model_device = getattr(getattr(self._classifier, "model", None), "device", None)
            self._device = str(model_device) if model_device is not None else self._resolve_device()
            self._model_loaded = True
        except Exception:
            self._classifier = None
            self._model_loaded = False
            self._device = self._resolve_device()
        return self._classifier

    def preload(self) -> None:
        self._load_finbert()

    def status(self) -> dict[str, bool | str]:
        return {
            "loaded": self._model_loaded,
            "device": self._device,
            "model": self.MODEL_ID,
        }

    def _get_classifier(self):
        if self._classifier is not None:
            return self._classifier
        return self._load_finbert()

    def analyze(self, texts: Sequence[str]) -> dict[str, float | str]:
        cleaned = [text.strip() for text in texts if text and text.strip()]
        if not cleaned:
            return {
                "label": "neutral",
                "score": 0.0,
                "source": "empty",
            }

        classifier = self._get_classifier()
        if classifier is None:
            positive_words = {"beat", "growth", "surge", "gain", "bullish", "upside"}
            negative_words = {"miss", "drop", "selloff", "fall", "bearish", "downside"}
            sentiment_score = 0
            for text in cleaned:
                lowered = text.lower()
                sentiment_score += sum(word in lowered for word in positive_words)
                sentiment_score -= sum(word in lowered for word in negative_words)
            label = "positive" if sentiment_score > 0 else "negative" if sentiment_score < 0 else "neutral"
            return {
                "label": label,
                "score": abs(float(sentiment_score)),
                "source": "lexical-fallback",
            }

        try:
            results = classifier(list(cleaned), truncation=True)
        except Exception:
            return {
                "label": "neutral",
                "score": 0.0,
                "source": "classifier-error",
            }

        score_total = 0.0
        label_score = 0
        for result in results:
            label = str(result.get("label", "")).lower()
            score = float(result.get("score", 0.0))
            score_total += score
            if "positive" in label:
                label_score += 1
            elif "negative" in label:
                label_score -= 1

        final_label = "neutral"
        if label_score > 0:
            final_label = "positive"
        elif label_score < 0:
            final_label = "negative"

        return {
            "label": final_label,
            "score": round(score_total / max(len(results), 1), 4),
            "source": self.MODEL_ID,
        }
