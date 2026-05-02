import logging
import uuid
from datetime import datetime
from typing import List, Optional

from app.db.mongo import mongo_db
from app.models.alert import Alert
from app.schemas.alert import NotificationResponse

logger = logging.getLogger(__name__)


class NotificationService:
    """Service for managing notifications via MongoDB with in-memory fallback."""
    
    def __init__(self):
        self.collection = mongo_db.notifications
        # In-memory storage for demo notifications when MongoDB isn't available
        self._memory_storage: List[dict] = []
    
    def send_in_app_notification(self, alert: Alert, message: str) -> Optional[NotificationResponse]:
        """
        Store a triggered alert as an in-app notification.
        
        Args:
            alert: The triggered alert
            message: Notification message
            
        Returns:
            Created notification or None if failed
        """
        notification = {
            "_id": str(uuid.uuid4()),
            "symbol": alert.symbol,
            "message": message,
            "alert_type": alert.alert_type,
            "triggered_at": datetime.utcnow(),
            "is_read": False,
            "alert_id": alert.id,
            "user_id": alert.user_id
        }
        
        try:
            result = self.collection.insert_one(notification)
            if result.inserted_id:
                logger.info(f"Notification created in MongoDB: {notification['_id']}")
                return NotificationResponse(
                    id=notification["_id"],
                    symbol=notification["symbol"],
                    message=notification["message"],
                    alert_type=notification["alert_type"],
                    triggered_at=notification["triggered_at"],
                    is_read=notification["is_read"]
                )
            
        except Exception as e:
            logger.warning(f"MongoDB not available, using in-memory storage: {str(e)}")
            # Store in memory when MongoDB isn't available
            self._memory_storage.append(notification)
            logger.info(f"Notification created in memory: {notification['_id']}")
            return NotificationResponse(
                id=notification["_id"],
                symbol=notification["symbol"],
                message=notification["message"],
                alert_type=notification["alert_type"],
                triggered_at=notification["triggered_at"],
                is_read=notification["is_read"]
            )
        
        return None
    
    def send_email_notification(self, alert: Alert, message: str) -> bool:
        """
        Send email notification for triggered alert.
        
        Args:
            alert: The triggered alert
            message: Notification message
            
        Returns:
            True if sent successfully, False otherwise
        """
        # Stub implementation - log to console for now
        # In production, integrate with SMTP service like SendGrid, SES, etc.
        try:
            logger.info(f"EMAIL NOTIFICATION: {alert.symbol} - {message}")
            # TODO: Implement actual email sending logic
            return True
        except Exception as e:
            logger.error(f"Failed to send email notification: {str(e)}")
            return False
    
    def get_notifications(self, unread_only: bool = True, limit: int = 50) -> List[NotificationResponse]:
        """
        Retrieve notifications from MongoDB or in-memory storage.
        
        Args:
            unread_only: Filter for unread notifications only
            limit: Maximum number of notifications to return
            
        Returns:
            List of notifications
        """
        try:
            query = {}
            if unread_only:
                query["is_read"] = False
            
            cursor = self.collection.find(query).sort("triggered_at", -1).limit(limit)
            notifications = []
            
            for doc in cursor:
                notifications.append(NotificationResponse(
                    id=doc["_id"],
                    symbol=doc["symbol"],
                    message=doc["message"],
                    alert_type=doc["alert_type"],
                    triggered_at=doc["triggered_at"],
                    is_read=doc["is_read"]
                ))
            
            return notifications
            
        except Exception as e:
            logger.warning(f"MongoDB not available, using in-memory storage: {str(e)}")
            # Fallback to in-memory storage when MongoDB isn't available
            notifications = []
            
            # Filter in-memory notifications
            memory_notifications = self._memory_storage
            if unread_only:
                memory_notifications = [n for n in memory_notifications if not n["is_read"]]
            
            # Sort by triggered_at (newest first) and limit
            memory_notifications.sort(key=lambda x: x["triggered_at"], reverse=True)
            memory_notifications = memory_notifications[:limit]
            
            for notification in memory_notifications:
                notifications.append(NotificationResponse(
                    id=notification["_id"],
                    symbol=notification["symbol"],
                    message=notification["message"],
                    alert_type=notification["alert_type"],
                    triggered_at=notification["triggered_at"],
                    is_read=notification["is_read"]
                ))
            
            logger.info(f"Retrieved {len(notifications)} notifications from memory")
            return notifications
    
    def mark_notification_read(self, notification_id: str) -> bool:
        """
        Mark a specific notification as read.
        
        Args:
            notification_id: ID of the notification to mark as read
            
        Returns:
            True if successful, False otherwise
        """
        try:
            result = self.collection.update_one(
                {"_id": notification_id},
                {"$set": {"is_read": True}}
            )
            return result.modified_count > 0
            
        except Exception as e:
            logger.warning(f"MongoDB not available, using in-memory storage: {str(e)}")
            # Fallback to in-memory storage
            for notification in self._memory_storage:
                if notification["_id"] == notification_id:
                    notification["is_read"] = True
                    logger.info(f"Marked notification {notification_id} as read in memory")
                    return True
            return False
    
    def mark_all_notifications_read(self, user_id: Optional[str] = None) -> bool:
        """
        Mark all notifications as read, optionally filtered by user.
        
        Args:
            user_id: Optional user ID to filter notifications
            
        Returns:
            True if successful, False otherwise
        """
        try:
            query = {}
            if user_id:
                query["user_id"] = user_id
            
            result = self.collection.update_many(
                query,
                {"$set": {"is_read": True}}
            )
            logger.info(f"Marked {result.modified_count} notifications as read")
            return True
            
        except Exception as e:
            logger.warning(f"MongoDB not available, using in-memory storage: {str(e)}")
            # Fallback to in-memory storage
            count = 0
            for notification in self._memory_storage:
                if user_id is None or notification.get("user_id") == user_id:
                    if not notification["is_read"]:
                        notification["is_read"] = True
                        count += 1
            logger.info(f"Marked {count} notifications as read in memory")
            return True
    
    def get_unread_count(self, user_id: Optional[str] = None) -> int:
        """
        Get count of unread notifications.
        
        Args:
            user_id: Optional user ID to filter notifications
            
        Returns:
            Count of unread notifications
        """
        try:
            query = {"is_read": False}
            if user_id:
                query["user_id"] = user_id
            
            return self.collection.count_documents(query)
            
        except Exception as e:
            logger.error(f"Failed to get unread count: {str(e)}")
            return 0
