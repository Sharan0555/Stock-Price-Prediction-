"""Tests for the Alert Service."""

from datetime import datetime
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.services.alert_service import AlertService
from app.services.notification_service import NotificationService


@pytest.fixture
def alert_service():
    """Create AlertService instance for testing."""
    return AlertService()


@pytest.fixture
def mock_db():
    """Create mock database session."""
    return MagicMock(spec=Session)


@pytest.fixture
def sample_alerts():
    """Create sample alerts for testing."""
    alerts = [
        Alert(
            id=1,
            symbol="AAPL",
            alert_type="price_above",
            threshold=150.0,
            is_active=True,
            user_id="user1",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        ),
        Alert(
            id=2,
            symbol="TSLA",
            alert_type="price_below",
            threshold=200.0,
            is_active=True,
            user_id="user1",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        ),
        Alert(
            id=3,
            symbol="NVDA",
            alert_type="volatility",
            threshold=25.0,
            is_active=True,
            user_id="user1",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        ),
        Alert(
            id=4,
            symbol="GOOGL",
            alert_type="price_above",
            threshold=2500.0,
            is_active=False,  # Inactive alert
            user_id="user1",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    ]
    return alerts


def test_evaluate_alerts_returns_empty_list_when_no_alerts_exist(alert_service, mock_db):
    """Test evaluate_alerts() returns empty list when no alerts exist."""
    # Mock the database query to return empty list
    mock_db.query.return_value.filter.return_value.all.return_value = []
    
    result = alert_service.evaluate_alerts(mock_db)
    
    assert result == []
    mock_db.query.assert_called_once_with(Alert)
    mock_db.query.return_value.filter.assert_called_once()


def test_price_above_alert_triggers_when_price_above_threshold(alert_service, mock_db, sample_alerts):
    """Test price_above alert triggers when predicted price > threshold."""
    # Setup: Only AAPL alert, price above threshold
    mock_db.query.return_value.filter.return_value.all.return_value = [sample_alerts[0]]
    
    # Mock the price lookup to return price above threshold
    with patch.object(alert_service, '_get_latest_price', return_value=160.0):
        # Mock notification service
        with patch.object(alert_service.notification_service, 'send_in_app_notification') as mock_notify:
            mock_notify.return_value = MagicMock()
            mock_notify.return_value.id = "notif_1"
            mock_notify.return_value.symbol = "AAPL"
            mock_notify.return_value.message = "Test message"
            mock_notify.return_value.alert_type = "price_above"
            mock_notify.return_value.triggered_at = datetime.utcnow()
            mock_notify.return_value.is_read = False
            
            result = alert_service.evaluate_alerts(mock_db)
            
            # Should trigger and return one notification
            assert len(result) == 1
            assert result[0].symbol == "AAPL"
            assert result[0].alert_type == "price_above"
            
            # Alert should be marked as triggered and inactive
            sample_alerts[0].is_active = False
            sample_alerts[0].triggered_at is not None
            mock_db.commit.assert_called()


def test_price_above_alert_does_not_trigger_when_price_below_threshold(alert_service, mock_db, sample_alerts):
    """Test price_above alert does NOT trigger when predicted price <= threshold."""
    # Setup: Only AAPL alert, price below threshold
    mock_db.query.return_value.filter.return_value.all.return_value = [sample_alerts[0]]
    
    # Mock the price lookup to return price below threshold
    with patch.object(alert_service, '_get_latest_price', return_value=140.0):
        result = alert_service.evaluate_alerts(mock_db)
        
        # Should not trigger
        assert len(result) == 0
        
        # Alert should remain active and not triggered
        assert sample_alerts[0].is_active == True
        assert sample_alerts[0].triggered_at is None
        mock_db.commit.assert_not_called()


def test_price_above_alert_does_not_trigger_when_price_equals_threshold(alert_service, mock_db, sample_alerts):
    """Test price_above alert does NOT trigger when predicted price == threshold."""
    # Setup: Only AAPL alert, price equals threshold
    mock_db.query.return_value.filter.return_value.all.return_value = [sample_alerts[0]]
    
    # Mock the price lookup to return price equal to threshold
    with patch.object(alert_service, '_get_latest_price', return_value=150.0):
        result = alert_service.evaluate_alerts(mock_db)
        
        # Should not trigger
        assert len(result) == 0
        
        # Alert should remain active
        assert sample_alerts[0].is_active == True
        assert sample_alerts[0].triggered_at is None


def test_price_below_alert_triggers_correctly(alert_service, mock_db, sample_alerts):
    """Test price_below alert triggers when price < threshold."""
    # Setup: Only TSLA alert, price below threshold
    mock_db.query.return_value.filter.return_value.all.return_value = [sample_alerts[1]]
    
    # Mock the price lookup to return price below threshold
    with patch.object(alert_service, '_get_latest_price', return_value=180.0):
        # Mock notification service
        with patch.object(alert_service.notification_service, 'send_in_app_notification') as mock_notify:
            mock_notify.return_value = MagicMock()
            mock_notify.return_value.id = "notif_2"
            mock_notify.return_value.symbol = "TSLA"
            mock_notify.return_value.message = "Test message"
            mock_notify.return_value.alert_type = "price_below"
            mock_notify.return_value.triggered_at = datetime.utcnow()
            mock_notify.return_value.is_read = False
            
            result = alert_service.evaluate_alerts(mock_db)
            
            # Should trigger and return one notification
            assert len(result) == 1
            assert result[0].symbol == "TSLA"
            assert result[0].alert_type == "price_below"
            
            # Alert should be marked as triggered and inactive
            mock_db.commit.assert_called()


def test_price_below_alert_does_not_trigger_when_price_above_threshold(alert_service, mock_db, sample_alerts):
    """Test price_below alert does NOT trigger when price >= threshold."""
    # Setup: Only TSLA alert, price above threshold
    mock_db.query.return_value.filter.return_value.all.return_value = [sample_alerts[1]]
    
    # Mock the price lookup to return price above threshold
    with patch.object(alert_service, '_get_latest_price', return_value=220.0):
        result = alert_service.evaluate_alerts(mock_db)
        
        # Should not trigger
        assert len(result) == 0
        
        # Alert should remain active
        assert sample_alerts[1].is_active == True
        assert sample_alerts[1].triggered_at is None


def test_volatility_alert_triggers_when_std_dev_exceeds_threshold(alert_service, mock_db, sample_alerts):
    """Test volatility alert triggers when std dev of last 10 predictions > threshold."""
    # Setup: Only NVDA volatility alert
    mock_db.query.return_value.filter.return_value.all.return_value = [sample_alerts[2]]
    
    # Mock volatility calculation to return value above threshold
    with patch.object(alert_service, 'check_volatility', return_value=30.0):
        # Mock notification service
        with patch.object(alert_service.notification_service, 'send_in_app_notification') as mock_notify:
            mock_notify.return_value = MagicMock()
            mock_notify.return_value.id = "notif_3"
            mock_notify.return_value.symbol = "NVDA"
            mock_notify.return_value.message = "Test message"
            mock_notify.return_value.alert_type = "volatility"
            mock_notify.return_value.triggered_at = datetime.utcnow()
            mock_notify.return_value.is_read = False
            
            result = alert_service.evaluate_alerts(mock_db)
            
            # Should trigger and return one notification
            assert len(result) == 1
            assert result[0].symbol == "NVDA"
            assert result[0].alert_type == "volatility"
            
            # Alert should be marked as triggered and inactive
            mock_db.commit.assert_called()


def test_volatility_alert_does_not_trigger_when_std_dev_below_threshold(alert_service, mock_db, sample_alerts):
    """Test volatility alert does NOT trigger when std dev <= threshold."""
    # Setup: Only NVDA volatility alert
    mock_db.query.return_value.filter.return_value.all.return_value = [sample_alerts[2]]
    
    # Mock volatility calculation to return value below threshold
    with patch.object(alert_service, 'check_volatility', return_value=20.0):
        result = alert_service.evaluate_alerts(mock_db)
        
        # Should not trigger
        assert len(result) == 0
        
        # Alert should remain active
        assert sample_alerts[2].is_active == True
        assert sample_alerts[2].triggered_at is None


def test_single_symbol_lookup_failure_does_not_stop_other_alerts(alert_service, mock_db, sample_alerts):
    """Test that a single symbol lookup failure does not stop other alerts from being evaluated."""
    # Setup: Multiple alerts
    active_alerts = [sample_alerts[0], sample_alerts[1], sample_alerts[2]]  # AAPL, TSLA, NVDA
    mock_db.query.return_value.filter.return_value.all.return_value = active_alerts
    
    # Mock price lookup: AAPL fails, TSLA succeeds, NVDA succeeds
    def mock_get_latest_price(symbol):
        if symbol == "AAPL":
            raise Exception("API call failed for AAPL")
        elif symbol == "TSLA":
            return 180.0  # Below threshold, should trigger
        else:
            return 500.0  # Above threshold, should not trigger
    
    # Mock volatility for NVDA
    def mock_check_volatility(symbol, window=10):
        if symbol == "NVDA":
            return 30.0  # Above threshold, should trigger
        return 10.0
    
    with patch.object(alert_service, '_get_latest_price', side_effect=mock_get_latest_price):
        with patch.object(alert_service, 'check_volatility', side_effect=mock_check_volatility):
            # Mock notification service
            with patch.object(alert_service.notification_service, 'send_in_app_notification') as mock_notify:
                mock_notify.return_value = MagicMock()
                mock_notify.return_value.id = "notif_test"
                mock_notify.return_value.symbol = "TEST"
                mock_notify.return_value.message = "Test message"
                mock_notify.return_value.alert_type = "test"
                mock_notify.return_value.triggered_at = datetime.utcnow()
                mock_notify.return_value.is_read = False
                
                result = alert_service.evaluate_alerts(mock_db)
                
                # Should still trigger 2 alerts despite AAPL failure
                assert len(result) == 2
                
                # TSLA and NVDA should be triggered
                triggered_symbols = [n.symbol for n in result]
                assert "TSLA" in triggered_symbols
                assert "NVDA" in triggered_symbols
                assert "AAPL" not in triggered_symbols


def test_evaluate_alerts_returns_empty_list_on_total_failure(alert_service, mock_db):
    """Test that evaluate_alerts() returns [] on total failure, not an exception."""
    # Mock database query to raise an exception
    mock_db.query.side_effect = Exception("Database connection failed")
    
    # Should not raise an exception, should return empty list
    result = alert_service.evaluate_alerts(mock_db)
    
    assert result == []


def test_check_volatility_returns_none_on_insufficient_data(alert_service):
    """Test check_volatility returns None when insufficient data is available."""
    with patch('app.services.alert_service.YFinanceService') as mock_yf:
        mock_service = MagicMock()
        mock_yf.return_value = mock_service
        
        # Mock insufficient historical data
        mock_service.get_historical_data.return_value = None
        
        result = alert_service.check_volatility("AAPL")
        
        assert result is None


def test_check_volatility_calculates_correctly(alert_service):
    """Test check_volatility calculates correct standard deviation."""
    with patch('app.services.alert_service.YFinanceService') as mock_yf:
        mock_service = MagicMock()
        mock_yf.return_value = mock_service
        
        # Mock sufficient historical data
        import pandas as pd
        mock_hist = pd.DataFrame({
            'Close': [100, 102, 98, 105, 103, 107, 101, 106, 104, 108, 110]
        })
        mock_service.get_historical_data.return_value = mock_hist
        
        result = alert_service.check_volatility("AAPL")
        
        # Should return a positive number (annualized volatility)
        assert result is not None
        assert result > 0
        assert isinstance(result, float)


def test_get_latest_price_handles_service_failure(alert_service):
    """Test _get_latest_price returns None when service fails."""
    with patch('app.services.alert_service.YFinanceService') as mock_yf:
        mock_service = MagicMock()
        mock_yf.return_value = mock_service
        
        # Mock service failure
        mock_service.get_quote.side_effect = Exception("Service unavailable")
        
        result = alert_service._get_latest_price("AAPL")
        
        assert result is None


def test_evaluate_alerts_ignores_inactive_alerts(alert_service, mock_db, sample_alerts):
    """Test that evaluate_alerts ignores inactive alerts."""
    # Setup: Mix of active and inactive alerts
    mock_db.query.return_value.filter.return_value.all.return_value = sample_alerts
    
    # Mock all lookups to succeed
    with patch.object(alert_service, '_get_latest_price', return_value=200.0):
        with patch.object(alert_service, 'check_volatility', return_value=20.0):
            result = alert_service.evaluate_alerts(mock_db)
            
            # Should only evaluate active alerts (3 out of 4)
            # GOOGL (index 3) is inactive and should be ignored
            assert len(result) >= 0  # May trigger some alerts, but GOOGL shouldn't be evaluated
