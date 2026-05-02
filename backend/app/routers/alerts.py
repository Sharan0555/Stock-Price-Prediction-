from contextlib import contextmanager
import logging
from types import GeneratorType
from typing import Generator, List, Optional

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertCreate, AlertResponse, AlertUpdate, NotificationResponse
from app.services.alert_service import AlertService
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)
router = APIRouter()


@contextmanager
def _db_session() -> Generator[Session, None, None]:
    provider = get_db()
    if isinstance(provider, GeneratorType):
        generator = provider
        db = next(generator)
        try:
            yield db
        finally:
            try:
                next(generator)
            except StopIteration:
                pass
    else:
        yield provider


@router.post("/alerts", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_alert(alert: AlertCreate):
    """Create a new price alert."""
    with _db_session() as db:
        try:
            db_alert = Alert(
                symbol=alert.symbol.upper(),
                alert_type=alert.alert_type,
                threshold=alert.threshold,
                user_id=alert.user_id,
                is_active=True
            )
            db.add(db_alert)
            db.commit()
            db.refresh(db_alert)
            return db_alert
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create alert: {str(e)}"
            )


@router.get("/alerts", response_model=List[AlertResponse])
async def list_alerts(
    symbol: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    """List all alerts, with optional filtering."""
    with _db_session() as db:
        query = db.query(Alert)
        
        if symbol:
            query = query.filter(Alert.symbol == symbol.upper())
        if is_active is not None:
            query = query.filter(Alert.is_active == is_active)
        
        alerts = query.order_by(Alert.created_at.desc()).all()
        return alerts


@router.get("/alerts/{alert_id}", response_model=AlertResponse)
async def get_alert(alert_id: int):
    """Get a specific alert by ID."""
    with _db_session() as db:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alert not found"
            )
        return alert


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(alert_id: int):
    """Delete an alert."""
    with _db_session() as db:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alert not found"
            )
        
        db.delete(alert)
        db.commit()


@router.patch("/alerts/{alert_id}", response_model=AlertResponse)
async def update_alert(alert_id: int, alert_update: AlertUpdate):
    """Update an alert (activate/deactivate)."""
    with _db_session() as db:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Alert not found"
            )
        
        update_data = alert_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(alert, field, value)
        
        db.commit()
        db.refresh(alert)
        return alert


@router.get("/notifications", response_model=List[NotificationResponse])
async def get_notifications(unread_only: bool = True):
    """Get notifications, optionally filtering for unread only."""
    try:
        notifications = NotificationService().get_notifications(unread_only)
        return notifications
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve notifications: {str(e)}"
        )


@router.patch("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_notification_read(notification_id: str):
    """Mark a specific notification as read."""
    try:
        success = NotificationService().mark_notification_read(notification_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark notification as read: {str(e)}"
        )


@router.patch("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_notifications_read():
    """Mark all notifications as read."""
    try:
        NotificationService().mark_all_notifications_read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark all notifications as read: {str(e)}"
        )


@router.post("/alerts/demo", response_model=List[NotificationResponse])
async def create_demo_alerts():
    """Create demo alerts and immediately trigger them as notifications."""
    logger.info("Creating demo alerts...")
    with _db_session() as db:
        try:
            notification_service = NotificationService()
            demo_alerts = [
                Alert(
                    symbol="AAPL",
                    alert_type="price_above",
                    threshold=150.0,
                    user_id="demo",
                    is_active=True
                ),
                Alert(
                    symbol="GOOGL",
                    alert_type="price_below",
                    threshold=100.0,
                    user_id="demo",
                    is_active=True
                ),
                Alert(
                    symbol="TSLA",
                    alert_type="volatility",
                    threshold=5.0,
                    user_id="demo",
                    is_active=True
                )
            ]
            
            for alert in demo_alerts:
                db.add(alert)
            db.commit()
            logger.info(f"Created {len(demo_alerts)} demo alerts in database")
            
            demo_notifications = []
            messages = [
                ("AAPL price crossed above $150.00 - Demo Alert", demo_alerts[0]),
                ("GOOGL price dropped below $100.00 - Demo Alert", demo_alerts[1]),
                ("TSLA volatility exceeded $5.00 - Demo Alert", demo_alerts[2])
            ]
            
            for message, alert in messages:
                notification = notification_service.send_in_app_notification(alert, message)
                if notification:
                    demo_notifications.append(notification)
                    logger.info(f"Created notification for {alert.symbol}")
                else:
                    logger.error(f"Failed to create notification for {alert.symbol}")
            
            logger.info(f"Returning {len(demo_notifications)} demo notifications")
            return demo_notifications
            
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create demo alerts: {str(e)}"
            )


@router.post("/alerts/evaluate", response_model=List[NotificationResponse])
async def evaluate_alerts_endpoint():
    """Manually trigger alert evaluation (for testing)."""
    with _db_session() as db:
        try:
            triggered_notifications = AlertService().evaluate_alerts(db)
            return triggered_notifications
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to evaluate alerts: {str(e)}"
            )
