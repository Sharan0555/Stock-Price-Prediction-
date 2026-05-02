"""Standalone tests for Alert System that avoid TensorFlow/FastAPI imports."""

import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch


class TestAlertServiceStandalone:
    """Standalone tests for AlertService without FastAPI dependencies."""
    
    def test_alert_service_import_and_instantiation(self):
        """Test AlertService can be imported and instantiated."""
        from app.services.alert_service import AlertService
        
        service = AlertService()
        assert service is not None
        assert hasattr(service, 'evaluate_alerts')
        assert hasattr(service, 'check_volatility')
        assert hasattr(service, 'notification_service')
        assert service.notification_service is not None

    def test_alert_service_evaluate_alerts_no_alerts(self):
        """Test evaluate_alerts returns empty list when no alerts exist."""
        from app.services.alert_service import AlertService
        
        service = AlertService()
        
        # Mock database session
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = []  # No alerts
        
        result = service.evaluate_alerts(mock_db)
        assert result == []
        
        # Verify database was queried
        mock_db.query.assert_called_once()

    def test_alert_service_price_above_triggers(self):
        """Test price_above alert triggers when price > threshold."""
        from app.services.alert_service import AlertService
        from app.models.alert import Alert
        
        service = AlertService()
        
        # Create test alert
        alert = Alert(
            id=1,
            symbol="AAPL",
            alert_type="price_above",
            threshold=150.0,
            is_active=True,
            user_id="user1",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Mock database
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [alert]
        
        # Mock price lookup to return price above threshold
        with patch.object(service, '_get_latest_price', return_value=160.0):
            with patch.object(service.notification_service, 'send_in_app_notification') as mock_notify:
                mock_notify.return_value = MagicMock()
                mock_notify.return_value.id = "notif_1"
                mock_notify.return_value.symbol = "AAPL"
                mock_notify.return_value.message = "Test message"
                mock_notify.return_value.alert_type = "price_above"
                mock_notify.return_value.triggered_at = datetime.utcnow()
                mock_notify.return_value.is_read = False
                
                result = service.evaluate_alerts(mock_db)
                
                # Should trigger and return one notification
                assert len(result) == 1
                assert result[0].symbol == "AAPL"
                assert result[0].alert_type == "price_above"
                
                # Alert should be marked as triggered
                assert alert.is_active == False
                assert alert.triggered_at is not None
                mock_db.commit.assert_called_once()

    def test_alert_service_price_above_no_trigger(self):
        """Test price_above alert does not trigger when price <= threshold."""
        from app.services.alert_service import AlertService
        from app.models.alert import Alert
        
        service = AlertService()
        
        # Create test alert
        alert = Alert(
            id=1,
            symbol="AAPL",
            alert_type="price_above",
            threshold=150.0,
            is_active=True,
            user_id="user1",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Mock database
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [alert]
        
        # Mock price lookup to return price below threshold
        with patch.object(service, '_get_latest_price', return_value=140.0):
            result = service.evaluate_alerts(mock_db)
            
            # Should not trigger
            assert len(result) == 0
            assert alert.is_active == True
            assert alert.triggered_at is None
            mock_db.commit.assert_not_called()

    def test_alert_service_price_below_triggers(self):
        """Test price_below alert triggers when price < threshold."""
        from app.services.alert_service import AlertService
        from app.models.alert import Alert
        
        service = AlertService()
        
        # Create test alert
        alert = Alert(
            id=1,
            symbol="TSLA",
            alert_type="price_below",
            threshold=200.0,
            is_active=True,
            user_id="user1",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Mock database
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [alert]
        
        # Mock price lookup to return price below threshold
        with patch.object(service, '_get_latest_price', return_value=180.0):
            with patch.object(service.notification_service, 'send_in_app_notification') as mock_notify:
                mock_notify.return_value = MagicMock()
                mock_notify.return_value.id = "notif_1"
                mock_notify.return_value.symbol = "TSLA"
                mock_notify.return_value.message = "Test message"
                mock_notify.return_value.alert_type = "price_below"
                mock_notify.return_value.triggered_at = datetime.utcnow()
                mock_notify.return_value.is_read = False
                
                result = service.evaluate_alerts(mock_db)
                
                # Should trigger and return one notification
                assert len(result) == 1
                assert result[0].symbol == "TSLA"
                assert result[0].alert_type == "price_below"
                
                # Alert should be marked as triggered
                assert alert.is_active == False
                assert alert.triggered_at is not None
                mock_db.commit.assert_called_once()

    def test_alert_service_volatility_triggers(self):
        """Test volatility alert triggers when volatility > threshold."""
        from app.services.alert_service import AlertService
        from app.models.alert import Alert
        
        service = AlertService()
        
        # Create test alert
        alert = Alert(
            id=1,
            symbol="NVDA",
            alert_type="volatility",
            threshold=25.0,
            is_active=True,
            user_id="user1",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Mock database
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [alert]
        
        # Mock volatility calculation to return value above threshold
        with patch.object(service, 'check_volatility', return_value=30.0):
            with patch.object(service.notification_service, 'send_in_app_notification') as mock_notify:
                mock_notify.return_value = MagicMock()
                mock_notify.return_value.id = "notif_1"
                mock_notify.return_value.symbol = "NVDA"
                mock_notify.return_value.message = "Test message"
                mock_notify.return_value.alert_type = "volatility"
                mock_notify.return_value.triggered_at = datetime.utcnow()
                mock_notify.return_value.is_read = False
                
                result = service.evaluate_alerts(mock_db)
                
                # Should trigger and return one notification
                assert len(result) == 1
                assert result[0].symbol == "NVDA"
                assert result[0].alert_type == "volatility"
                
                # Alert should be marked as triggered
                assert alert.is_active == False
                assert alert.triggered_at is not None
                mock_db.commit.assert_called_once()

    def test_alert_service_single_failure_continues(self):
        """Test that single symbol lookup failure doesn't stop other alerts."""
        from app.services.alert_service import AlertService
        from app.models.alert import Alert
        
        service = AlertService()
        
        # Create test alerts
        alert1 = Alert(
            id=1, symbol="AAPL", alert_type="price_above", threshold=150.0,
            is_active=True, user_id="user1", created_at=datetime.utcnow(), updated_at=datetime.utcnow()
        )
        alert2 = Alert(
            id=2, symbol="TSLA", alert_type="price_below", threshold=200.0,
            is_active=True, user_id="user1", created_at=datetime.utcnow(), updated_at=datetime.utcnow()
        )
        
        # Mock database
        mock_db = MagicMock()
        mock_query = MagicMock()
        mock_db.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.return_value = [alert1, alert2]
        
        # Mock price lookup: AAPL fails, TSLA succeeds
        def mock_get_latest_price(symbol):
            if symbol == "AAPL":
                raise Exception("API call failed for AAPL")
            elif symbol == "TSLA":
                return 180.0  # Below threshold, should trigger
        
        with patch.object(service, '_get_latest_price', side_effect=mock_get_latest_price):
            with patch.object(service.notification_service, 'send_in_app_notification') as mock_notify:
                def mock_send_notification(alert, message):
                    mock_notification = MagicMock()
                    mock_notification.id = f"notif_{alert.symbol}"
                    mock_notification.symbol = alert.symbol
                    mock_notification.message = message
                    mock_notification.alert_type = alert.alert_type
                    mock_notification.triggered_at = datetime.utcnow()
                    mock_notification.is_read = False
                    return mock_notification
                
                mock_notify.side_effect = mock_send_notification
                
                result = service.evaluate_alerts(mock_db)
                
                # Should still trigger 1 alert despite AAPL failure
                assert len(result) == 1
                assert result[0].symbol == "TSLA"

    def test_alert_service_total_failure_returns_empty(self):
        """Test that evaluate_alerts returns [] on total failure, not exception."""
        from app.services.alert_service import AlertService
        
        service = AlertService()
        
        # Mock database to raise an exception
        mock_db = MagicMock()
        mock_db.query.side_effect = Exception("Database connection failed")
        
        # Should not raise an exception, should return empty list
        result = service.evaluate_alerts(mock_db)
        assert result == []

    def test_get_latest_price_service_failure(self):
        """Test _get_latest_price returns None when service fails."""
        from app.services.alert_service import AlertService
        
        service = AlertService()
        
        # Mock YFinanceService to raise an exception
        with patch('app.services.yfinance_service.YFinanceService') as mock_yf:
            mock_service = MagicMock()
            mock_yf.return_value = mock_service
            mock_service.get_quote.side_effect = Exception("Service unavailable")
            
            result = service._get_latest_price("AAPL")
            assert result is None

    def test_check_volatility_insufficient_data(self):
        """Test check_volatility returns None when insufficient data."""
        from app.services.alert_service import AlertService
        
        service = AlertService()
        
        # Mock YFinanceService to return None
        with patch('app.services.yfinance_service.YFinanceService') as mock_yf:
            mock_service = MagicMock()
            mock_yf.return_value = mock_service
            mock_service.get_historical_data.return_value = None
            
            result = service.check_volatility("AAPL")
            assert result is None


class TestNotificationServiceStandalone:
    """Standalone tests for NotificationService."""
    
    def test_notification_service_instantiation(self):
        """Test NotificationService can be instantiated."""
        from app.services.notification_service import NotificationService
        
        service = NotificationService()
        assert service is not None
        assert hasattr(service, 'send_in_app_notification')
        assert hasattr(service, 'get_notifications')
        assert hasattr(service, 'mark_notification_read')

    def test_email_notification_stub(self):
        """Test email notification stub returns True."""
        from app.services.notification_service import NotificationService
        from app.models.alert import Alert
        
        service = NotificationService()
        
        # Create mock alert
        alert = Alert(
            id=1,
            symbol="AAPL",
            alert_type="price_above",
            threshold=150.0,
            is_active=True,
            user_id="user1",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Email notification should return True (stub implementation)
        result = service.send_email_notification(alert, "Test message")
        assert result is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
