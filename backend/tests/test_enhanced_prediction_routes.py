from __future__ import annotations

from unittest.mock import AsyncMock


def test_prediction_snapshot_endpoint(client) -> None:
    history = [{"t": 1_700_000_000 + index * 86_400, "c": 100.0 + index} for index in range(60)]
    quote = {
        "c": 160.0,
        "d": 2.0,
        "dp": 1.27,
        "h": 161.0,
        "l": 158.0,
        "o": 159.0,
        "pc": 158.0,
        "v": 1200,
        "t": 1_700_000_000,
    }

    import app.routers.prediction_router as prediction_router

    original_history = prediction_router._yfinance_service.get_daily_series
    original_quote = prediction_router._yfinance_service.get_quote
    original_live = client.app.state.live_price_service.get_price
    original_alpha = client.app.state.alpha_vantage_service.get_quote
    original_predict = prediction_router._model_trainer.predict
    original_risk = prediction_router._model_trainer.compute_risk_profile

    captured: dict[str, str | None] = {"symbol": None}

    prediction_router._yfinance_service.get_daily_series = AsyncMock(return_value=history)
    prediction_router._yfinance_service.get_quote = AsyncMock(return_value=quote)
    client.app.state.live_price_service.get_price = AsyncMock(return_value=None)
    client.app.state.alpha_vantage_service.get_quote = AsyncMock(return_value=None)

    def fake_predict(closes, volumes=None, symbol=None):
        captured["symbol"] = symbol
        return {"lstm": 159.5, "ensemble": 162.0, "signal": "BUY"}

    def fake_risk(closes, predicted, signal=None):
        return {
            "score": 42.0,
            "level": "medium",
            "signal": signal or "HOLD",
            "last_price": round(float(closes[-1]), 2),
            "change_pct": 1.25,
        }

    prediction_router._model_trainer.predict = fake_predict
    prediction_router._model_trainer.compute_risk_profile = fake_risk

    try:
        response = client.get("/api/v1/predictions/AAPL?days=60")
    finally:
        prediction_router._yfinance_service.get_daily_series = original_history
        prediction_router._yfinance_service.get_quote = original_quote
        client.app.state.live_price_service.get_price = original_live
        client.app.state.alpha_vantage_service.get_quote = original_alpha
        prediction_router._model_trainer.predict = original_predict
        prediction_router._model_trainer.compute_risk_profile = original_risk

    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "AAPL"
    assert len(data["history"]) == 60
    assert "predictions" in data
    assert "indicators" in data
    assert captured["symbol"] == "AAPL"


def test_price_websocket_endpoint(client) -> None:
    payload = {
        "symbol": "AAPL",
        "price": 188.42,
        "change_pct": 0.91,
        "volume": 3200,
        "ts": 1_700_000_000_000,
    }

    original_live = client.app.state.live_price_service.get_price
    original_alpha = client.app.state.alpha_vantage_service.get_quote
    client.app.state.live_price_service.get_price = AsyncMock(return_value=payload)
    client.app.state.alpha_vantage_service.get_quote = AsyncMock(return_value=None)

    try:
        with client.websocket_connect("/api/v1/ws/prices/AAPL") as websocket:
            data = websocket.receive_json()
    finally:
        client.app.state.live_price_service.get_price = original_live
        client.app.state.alpha_vantage_service.get_quote = original_alpha

    assert data["symbol"] == "AAPL"
    assert data["price"] == 188.42
    assert data["source"] == "finnhub-ws"
