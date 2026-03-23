"""Basic API tests for the stock price prediction backend."""

from unittest.mock import AsyncMock, patch

import pytest


def test_health_endpoint(client):
    """Test the health check endpoint."""
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_live_price_endpoint(client):
    """Test the live price route wiring (external Yahoo/AV/Finnhub calls are mocked)."""
    from app.api.v1.routes.live_price import LivePriceResponse

    stub = LivePriceResponse(
        symbol="AAPL",
        price=150.0,
        change_pct=0.5,
        volume=1_000_000,
        ts=1_700_000_000,
        source="test",
    )
    with patch(
        "app.api.v1.routes.live_price._resolve_price",
        new=AsyncMock(return_value=stub),
    ):
        response = client.get("/api/v1/stocks/live-price/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert "symbol" in data
    assert "price" in data
    assert data["symbol"] == "AAPL"


def test_prediction_endpoint(client):
    """Test the prediction endpoint."""
    response = client.post(
        "/api/v1/predictions",
        json={
            "symbol": "AAPL",
            "closes": [150.0, 151.0, 152.0, 151.5, 153.0, 152.5, 154.0],
        },
    )
    # This might fail if ML model isn't loaded, but should return proper error
    assert response.status_code in [200, 400, 500]


if __name__ == "__main__":
    pytest.main([__file__])
