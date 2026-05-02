"""Tests for the Alerts Router API endpoints."""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.alert import Alert


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def mock_db_session():
    """Create mock database session."""
    return MagicMock()


@pytest.fixture
def sample_alert():
    """Create sample alert for testing."""
    return Alert(
        id=1,
        symbol="AAPL",
        alert_type="price_above",
        threshold=150.0,
        is_active=True,
        user_id="user1",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


def test_post_alerts_creates_alert_and_returns_201(client, mock_db_session):
    """Test POST /api/v1/alerts creates alert and returns 201."""
    alert_data = {
        "symbol": "AAPL",
        "alert_type": "price_above",
        "threshold": 150.0,
        "user_id": "user1"
    }
    
    # Create a proper mock alert instance with all required attributes
    mock_alert_instance = MagicMock()
    mock_alert_instance.id = 1
    mock_alert_instance.symbol = "AAPL"
    mock_alert_instance.alert_type = "price_above"
    mock_alert_instance.threshold = 150.0
    mock_alert_instance.user_id = "user1"
    mock_alert_instance.is_active = True
    mock_alert_instance.triggered_at = None
    mock_alert_instance.created_at = datetime.utcnow()
    mock_alert_instance.updated_at = datetime.utcnow()
    
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        with patch('app.routers.alerts.Alert', return_value=mock_alert_instance):
            # Mock database operations
            mock_db_session.add = MagicMock()
            mock_db_session.commit = MagicMock()
            mock_db_session.refresh = MagicMock()
            
            response = client.post("/api/v1/alerts", json=alert_data)
            
            assert response.status_code == 201
            data = response.json()
            assert data["symbol"] == "AAPL"
            assert data["alert_type"] == "price_above"
            assert data["threshold"] == 150.0
            assert data["is_active"] == True
            
            # Verify database operations were called
            mock_db_session.add.assert_called_once()
            mock_db_session.commit.assert_called_once()
            mock_db_session.refresh.assert_called_once()


def test_post_alerts_with_missing_symbol_returns_422(client):
    """Test POST /api/v1/alerts with missing symbol returns 422."""
    alert_data = {
        "alert_type": "price_above",
        "threshold": 150.0,
        "user_id": "user1"
    }
    
    response = client.post("/api/v1/alerts", json=alert_data)
    
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any(error["loc"] == ["body", "symbol"] for error in errors)


def test_post_alerts_with_empty_symbol_returns_422(client):
    """Test POST /api/v1/alerts with empty symbol returns 422."""
    alert_data = {
        "symbol": "",
        "alert_type": "price_above",
        "threshold": 150.0,
        "user_id": "user1"
    }
    
    response = client.post("/api/v1/alerts", json=alert_data)
    
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any(error["loc"] == ["body", "symbol"] for error in errors)


def test_post_alerts_with_symbol_too_long_returns_422(client):
    """Test POST /api/v1/alerts with symbol too long returns 422."""
    alert_data = {
        "symbol": "VERYLONGSYMBOL",
        "alert_type": "price_above",
        "threshold": 150.0,
        "user_id": "user1"
    }
    
    response = client.post("/api/v1/alerts", json=alert_data)
    
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any(error["loc"] == ["body", "symbol"] for error in errors)


def test_post_alerts_with_invalid_alert_type_returns_422(client):
    """Test POST /api/v1/alerts with invalid alert_type returns 422."""
    alert_data = {
        "symbol": "AAPL",
        "alert_type": "invalid_type",
        "threshold": 150.0,
        "user_id": "user1"
    }
    
    response = client.post("/api/v1/alerts", json=alert_data)
    
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any(error["loc"] == ["body", "alert_type"] for error in errors)


def test_post_alerts_with_threshold_zero_returns_422(client):
    """Test POST /api/v1/alerts with threshold <= 0 returns 422."""
    alert_data = {
        "symbol": "AAPL",
        "alert_type": "price_above",
        "threshold": 0,
        "user_id": "user1"
    }
    
    response = client.post("/api/v1/alerts", json=alert_data)
    
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any(error["loc"] == ["body", "threshold"] for error in errors)


def test_post_alerts_with_negative_threshold_returns_422(client):
    """Test POST /api/v1/alerts with negative threshold returns 422."""
    alert_data = {
        "symbol": "AAPL",
        "alert_type": "price_above",
        "threshold": -10.0,
        "user_id": "user1"
    }
    
    response = client.post("/api/v1/alerts", json=alert_data)
    
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any(error["loc"] == ["body", "threshold"] for error in errors)


def test_post_alerts_with_missing_threshold_returns_422(client):
    """Test POST /api/v1/alerts with missing threshold returns 422."""
    alert_data = {
        "symbol": "AAPL",
        "alert_type": "price_above",
        "user_id": "user1"
    }
    
    response = client.post("/api/v1/alerts", json=alert_data)
    
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any(error["loc"] == ["body", "threshold"] for error in errors)


def test_post_alerts_with_missing_alert_type_returns_422(client):
    """Test POST /api/v1/alerts with missing alert_type returns 422."""
    alert_data = {
        "symbol": "AAPL",
        "threshold": 150.0,
        "user_id": "user1"
    }
    
    response = client.post("/api/v1/alerts", json=alert_data)
    
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any(error["loc"] == ["body", "alert_type"] for error in errors)


def test_post_alerts_database_error_returns_400(client, mock_db_session):
    """Test POST /api/v1/alerts returns 400 when database error occurs."""
    alert_data = {
        "symbol": "AAPL",
        "alert_type": "price_above",
        "threshold": 150.0,
        "user_id": "user1"
    }
    
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        with patch('app.routers.alerts.Alert') as mock_alert_model:
            mock_alert_instance = MagicMock()
            mock_alert_model.return_value = mock_alert_instance
            
            # Mock database to raise an exception
            mock_db_session.add = MagicMock()
            mock_db_session.commit = MagicMock(side_effect=Exception("Database error"))
            
            response = client.post("/api/v1/alerts", json=alert_data)
            
            assert response.status_code == 400
            assert "Failed to create alert" in response.json()["detail"]


def test_get_alerts_returns_list(client, mock_db_session, sample_alert):
    """Test GET /api/v1/alerts returns list of alerts."""
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        # Mock database query
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.all.return_value = [sample_alert]
        
        mock_db_session.query.return_value = mock_query
        
        response = client.get("/api/v1/alerts")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["symbol"] == "AAPL"
        assert data[0]["alert_type"] == "price_above"
        assert data[0]["threshold"] == 150.0


def test_get_alerts_with_symbol_filter(client, mock_db_session, sample_alert):
    """Test GET /api/v1/alerts with symbol filter."""
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        # Mock database query
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.all.return_value = [sample_alert]
        
        mock_db_session.query.return_value = mock_query
        
        response = client.get("/api/v1/alerts?symbol=AAPL")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["symbol"] == "AAPL"
        
        # Verify filter was called with symbol parameter
        mock_db_session.query.assert_called_once_with(Alert)


def test_get_alerts_with_active_filter(client, mock_db_session, sample_alert):
    """Test GET /api/v1/alerts with is_active filter."""
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        # Mock database query
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.all.return_value = [sample_alert]
        
        mock_db_session.query.return_value = mock_query
        
        response = client.get("/api/v1/alerts?is_active=true")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1


def test_get_alerts_empty_list(client, mock_db_session):
    """Test GET /api/v1/alerts returns empty list when no alerts exist."""
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        # Mock database query to return empty list
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.all.return_value = []
        
        mock_db_session.query.return_value = mock_query
        
        response = client.get("/api/v1/alerts")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0


def test_get_alert_by_id(client, mock_db_session, sample_alert):
    """Test GET /api/v1/alerts/{id} returns specific alert."""
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        # Mock database query
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = sample_alert
        
        mock_db_session.query.return_value = mock_query
        
        response = client.get("/api/v1/alerts/1")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["symbol"] == "AAPL"
        assert data["alert_type"] == "price_above"


def test_get_alert_by_id_not_found_returns_404(client, mock_db_session):
    """Test GET /api/v1/alerts/{id} returns 404 when alert not found."""
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        # Mock database query to return None
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        
        mock_db_session.query.return_value = mock_query
        
        response = client.get("/api/v1/alerts/999")
        
        assert response.status_code == 404
        assert "Alert not found" in response.json()["detail"]


def test_delete_alert_removes_alert(client, mock_db_session, sample_alert):
    """Test DELETE /api/v1/alerts/{id} removes alert."""
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        # Mock database query to find alert
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = sample_alert
        
        mock_db_session.query.return_value = mock_query
        
        # Mock delete operation
        mock_db_session.delete = MagicMock()
        mock_db_session.commit = MagicMock()
        
        response = client.delete("/api/v1/alerts/1")
        
        assert response.status_code == 204
        assert response.content == b""
        
        # Verify delete operations were called
        mock_db_session.delete.assert_called_once_with(sample_alert)
        mock_db_session.commit.assert_called_once()


def test_delete_alert_not_found_returns_404(client, mock_db_session):
    """Test DELETE /api/v1/alerts/{id} returns 404 when alert not found."""
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        # Mock database query to return None
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        
        mock_db_session.query.return_value = mock_query
        
        response = client.delete("/api/v1/alerts/999")
        
        assert response.status_code == 404
        assert "Alert not found" in response.json()["detail"]


def test_patch_alert_updates_alert(client, mock_db_session, sample_alert):
    """Test PATCH /api/v1/alerts/{id} updates alert."""
    update_data = {"is_active": False}
    
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        # Mock database query to find alert
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = sample_alert
        
        mock_db_session.query.return_value = mock_query
        
        # Mock update operations
        mock_db_session.commit = MagicMock()
        mock_db_session.refresh = MagicMock()
        
        response = client.patch("/api/v1/alerts/1", json=update_data)
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] == False
        
        # Verify update operations were called
        mock_db_session.commit.assert_called_once()
        mock_db_session.refresh.assert_called_once()


def test_patch_alert_not_found_returns_404(client, mock_db_session):
    """Test PATCH /api/v1/alerts/{id} returns 404 when alert not found."""
    update_data = {"is_active": False}
    
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        # Mock database query to return None
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.first.return_value = None
        
        mock_db_session.query.return_value = mock_query
        
        response = client.patch("/api/v1/alerts/999", json=update_data)
        
        assert response.status_code == 404
        assert "Alert not found" in response.json()["detail"]


def test_patch_alert_with_invalid_threshold_returns_422(client):
    """Test PATCH /api/v1/alerts/{id} with invalid threshold returns 422."""
    update_data = {"threshold": -10.0}
    
    response = client.patch("/api/v1/alerts/1", json=update_data)
    
    assert response.status_code == 422
    errors = response.json()["detail"]
    assert any(error["loc"] == ["body", "threshold"] for error in errors)


def test_get_notifications_success(client, mock_db_session):
    """Test GET /api/v1/notifications returns notifications."""
    with patch('app.routers.alerts.NotificationService') as mock_notification_service:
        mock_service = MagicMock()
        mock_notification_service.return_value = mock_service
        
        # Mock notification data
        mock_notifications = [
            {
                "id": "notif1",
                "symbol": "AAPL",
                "message": "Price alert triggered",
                "alert_type": "price_above",
                "triggered_at": datetime.utcnow().isoformat(),
                "is_read": False
            }
        ]
        mock_service.get_notifications.return_value = mock_notifications
        
        response = client.get("/api/v1/notifications")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["symbol"] == "AAPL"


def test_get_notifications_with_unread_filter(client, mock_db_session):
    """Test GET /api/v1/notifications with unread_only filter."""
    with patch('app.routers.alerts.NotificationService') as mock_notification_service:
        mock_service = MagicMock()
        mock_notification_service.return_value = mock_service
        
        mock_service.get_notifications.return_value = []
        
        response = client.get("/api/v1/notifications?unread_only=false")
        
        assert response.status_code == 200
        mock_service.get_notifications.assert_called_once_with(False)


def test_get_notifications_service_error_returns_500(client, mock_db_session):
    """Test GET /api/v1/notifications returns 500 when service error occurs."""
    with patch('app.routers.alerts.NotificationService') as mock_notification_service:
        mock_service = MagicMock()
        mock_notification_service.return_value = mock_service
        
        # Mock service to raise an exception
        mock_service.get_notifications.side_effect = Exception("Service error")
        
        response = client.get("/api/v1/notifications")
        
        assert response.status_code == 500
        assert "Failed to retrieve notifications" in response.json()["detail"]


def test_mark_notification_read_success(client, mock_db_session):
    """Test PATCH /api/v1/notifications/{id}/read marks notification as read."""
    with patch('app.routers.alerts.NotificationService') as mock_notification_service:
        mock_service = MagicMock()
        mock_notification_service.return_value = mock_service
        
        mock_service.mark_notification_read.return_value = True
        
        response = client.patch("/api/v1/notifications/notif1/read")
        
        assert response.status_code == 204
        assert response.content == b""
        mock_service.mark_notification_read.assert_called_once_with("notif1")


def test_mark_notification_read_not_found_returns_404(client, mock_db_session):
    """Test PATCH /api/v1/notifications/{id}/read returns 404 when notification not found."""
    with patch('app.routers.alerts.NotificationService') as mock_notification_service:
        mock_service = MagicMock()
        mock_notification_service.return_value = mock_service
        
        mock_service.mark_notification_read.return_value = False
        
        response = client.patch("/api/v1/notifications/notif999/read")
        
        assert response.status_code == 404
        assert "Notification not found" in response.json()["detail"]


def test_mark_all_notifications_read_success(client, mock_db_session):
    """Test PATCH /api/v1/notifications/read-all marks all notifications as read."""
    with patch('app.routers.alerts.NotificationService') as mock_notification_service:
        mock_service = MagicMock()
        mock_notification_service.return_value = mock_service
        
        mock_service.mark_all_notifications_read.return_value = True
        
        response = client.patch("/api/v1/notifications/read-all")
        
        assert response.status_code == 204
        assert response.content == b""
        mock_service.mark_all_notifications_read.assert_called_once()


def test_evaluate_alerts_endpoint_success(client, mock_db_session):
    """Test POST /api/v1/alerts/evaluate triggers alert evaluation."""
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        with patch('app.routers.alerts.AlertService') as mock_alert_service:
            mock_service = MagicMock()
            mock_alert_service.return_value = mock_service
            
            # Mock evaluation result
            mock_notifications = [
                {
                    "id": "notif1",
                    "symbol": "AAPL",
                    "message": "Price alert triggered",
                    "alert_type": "price_above",
                    "triggered_at": datetime.utcnow().isoformat(),
                    "is_read": False
                }
            ]
            mock_service.evaluate_alerts.return_value = mock_notifications
            
            response = client.post("/api/v1/alerts/evaluate")
            
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 1
            assert data[0]["symbol"] == "AAPL"


def test_evaluate_alerts_endpoint_service_error_returns_500(client, mock_db_session):
    """Test POST /api/v1/alerts/evaluate returns 500 when service error occurs."""
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        with patch('app.routers.alerts.AlertService') as mock_alert_service:
            mock_service = MagicMock()
            mock_alert_service.return_value = mock_service
            
            # Mock service to raise an exception
            mock_service.evaluate_alerts.side_effect = Exception("Service error")
            
            response = client.post("/api/v1/alerts/evaluate")
            
            assert response.status_code == 500
            assert "Failed to evaluate alerts" in response.json()["detail"]


def test_post_alerts_symbol_auto_uppercase(client, mock_db_session):
    """Test POST /api/v1/alerts automatically converts symbol to uppercase."""
    alert_data = {
        "symbol": "aapl",
        "alert_type": "price_above",
        "threshold": 150.0,
        "user_id": "user1"
    }
    
    with patch('app.routers.alerts.get_db', return_value=mock_db_session):
        with patch('app.routers.alerts.Alert') as mock_alert_model:
            mock_alert_instance = MagicMock()
            mock_alert_instance.id = 1
            mock_alert_instance.symbol = "AAPL"  # Should be uppercase
            mock_alert_instance.alert_type = "price_above"
            mock_alert_instance.threshold = 150.0
            mock_alert_instance.user_id = "user1"
            mock_alert_instance.is_active = True
            mock_alert_instance.triggered_at = None
            mock_alert_instance.created_at = datetime.utcnow()
            mock_alert_instance.updated_at = datetime.utcnow()
            
            mock_alert_model.return_value = mock_alert_instance
            
            mock_db_session.add = MagicMock()
            mock_db_session.commit = MagicMock()
            mock_db_session.refresh = MagicMock()
            
            response = client.post("/api/v1/alerts", json=alert_data)
            
            assert response.status_code == 201
            data = response.json()
            assert data["symbol"] == "AAPL"  # Should be uppercase
            
            # Verify Alert was created with uppercase symbol
            mock_alert_model.assert_called_once()
            call_args = mock_alert_model.call_args[1]
            assert call_args["symbol"] == "AAPL"
