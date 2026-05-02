import asyncio
import inspect
import logging
from datetime import datetime, timedelta
from typing import List

import numpy as np
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.schemas.alert import NotificationResponse
from app.services.notification_service import NotificationService
from app.services.yfinance_service import YFinanceService

logger = logging.getLogger(__name__)


class AlertService:
    """Service for evaluating and managing price alerts."""
    
    def __init__(self):
        self.notification_service = NotificationService()

    def _resolve_result(self, result):
        if inspect.isawaitable(result):
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                return asyncio.run(result)

            from concurrent.futures import ThreadPoolExecutor

            with ThreadPoolExecutor(max_workers=1) as executor:
                return executor.submit(asyncio.run, result).result()
        return result

    def _build_notification_response(
        self,
        alert: Alert,
        message: str,
        notification: NotificationResponse | object | None,
    ) -> NotificationResponse:
        notification_id = ""
        triggered_at = datetime.utcnow()
        is_read = False

        if notification is not None:
            notification_id = str(getattr(notification, "id", "") or "")
            triggered_at = getattr(notification, "triggered_at", triggered_at)
            is_read = bool(getattr(notification, "is_read", False))

        return NotificationResponse(
            id=notification_id or f"{alert.symbol.lower()}-{int(triggered_at.timestamp())}",
            symbol=alert.symbol,
            message=message,
            alert_type=alert.alert_type,
            triggered_at=triggered_at,
            is_read=is_read,
        )
    
    def evaluate_alerts(self, db: Session) -> List[NotificationResponse]:
        """
        Evaluate all active alerts against current/predicted prices.
        
        Args:
            db: Database session
            
        Returns:
            List of triggered notifications
        """
        triggered_notifications = []
        
        try:
            # Get all active alerts
            active_alerts = db.query(Alert).filter(Alert.is_active == True).all()
            logger.info(f"Evaluating {len(active_alerts)} active alerts")
            
            for alert in active_alerts:
                try:
                    should_trigger = False
                    message = ""
                    
                    if alert.alert_type == "price_above":
                        current_price = self._get_latest_price(alert.symbol)
                        if current_price and current_price > alert.threshold:
                            should_trigger = True
                            message = f"{alert.symbol} price (${current_price:.2f}) went above threshold (${alert.threshold:.2f})"
                    
                    elif alert.alert_type == "price_below":
                        current_price = self._get_latest_price(alert.symbol)
                        if current_price and current_price < alert.threshold:
                            should_trigger = True
                            message = f"{alert.symbol} price (${current_price:.2f}) went below threshold (${alert.threshold:.2f})"
                    
                    elif alert.alert_type == "volatility":
                        volatility = self.check_volatility(alert.symbol)
                        if volatility and volatility > alert.threshold:
                            should_trigger = True
                            message = f"{alert.symbol} volatility ({volatility:.2f}%) exceeded threshold ({alert.threshold:.2f}%)"
                    
                    if should_trigger:
                        # Mark alert as triggered
                        alert.triggered_at = datetime.utcnow()
                        alert.is_active = False
                        db.commit()
                        
                        # Send notification
                        notification = self.notification_service.send_in_app_notification(
                            alert, message
                        )
                        triggered_notifications.append(
                            self._build_notification_response(
                                alert,
                                message,
                                notification,
                            )
                        )
                        
                        logger.info(f"Alert triggered: {alert.symbol} - {message}")
                    
                except Exception as e:
                    logger.error(f"Error evaluating alert {alert.id} for symbol {alert.symbol}: {str(e)}")
                    # Continue with next alert instead of crashing
                    continue
            
            logger.info(f"Alert evaluation completed. {len(triggered_notifications)} alerts triggered.")
            return triggered_notifications
            
        except Exception as e:
            logger.error(f"Critical error in alert evaluation: {str(e)}")
            # Return empty list to prevent scheduler crashes
            return []
    
    def _get_latest_price(self, symbol: str) -> float | None:
        """
        Get the latest price for a symbol from prediction service or cache.
        
        Args:
            symbol: Stock symbol
            
        Returns:
            Latest price or None if unavailable
        """
        try:
            yf_service = YFinanceService()
            quote = self._resolve_result(yf_service.get_quote(symbol))
            if not isinstance(quote, dict):
                return None
            if quote.get("c") is not None:
                return float(quote["c"])
            if quote.get("price") is not None:
                return float(quote["price"])
            return None
        except Exception as e:
            logger.error(f"Failed to get price for {symbol}: {str(e)}")
            return None

    def check_volatility(self, symbol: str, window: int = 10) -> float | None:
        """
        Calculate rolling standard deviation of recent prices/predictions.
        
        Args:
            symbol: Stock symbol
            window: Number of recent data points to consider
            
        Returns:
            Volatility as percentage or None if insufficient data
        """
        try:
            yf_service = YFinanceService()
            hist = yf_service.get_historical_data(symbol, period=f"{window+1}d")
            if hist is None or len(hist) < window:
                return None
            
            # Calculate daily returns and standard deviation
            prices = hist['Close'].values
            if len(prices) < 2:
                return None
            
            returns = np.diff(prices) / prices[:-1] * 100  # Percentage returns
            volatility = np.std(returns) * np.sqrt(252)  # Annualized volatility
            
            return float(volatility)
            
        except Exception as e:
            logger.error(f"Failed to calculate volatility for {symbol}: {str(e)}")
            return None
