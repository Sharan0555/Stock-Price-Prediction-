from __future__ import annotations

from app import main


def test_default_allowed_origins_include_local_dev_hosts(monkeypatch):
    monkeypatch.delenv("BACKEND_CORS_ORIGINS", raising=False)
    monkeypatch.delenv("FRONTEND_URL", raising=False)

    origins = main._get_allowed_origins()

    assert "http://localhost:3000" in origins
    assert "http://127.0.0.1:3000" in origins
    assert "https://stock-price-prediction-5087a.web.app" in origins
    assert "https://stock-price-prediction-5087a.firebaseapp.com" in origins
