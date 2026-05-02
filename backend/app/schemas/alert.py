from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, ConfigDict


class AlertBase(BaseModel):
    """Base schema for alert operations."""
    symbol: str = Field(..., min_length=1, max_length=10, description="Stock symbol (e.g., AAPL)")
    alert_type: Literal["price_above", "price_below", "volatility"] = Field(
        ...,
        description="Alert type: price_above, price_below, volatility",
    )
    threshold: float = Field(..., gt=0, description="Alert threshold value")
    user_id: Optional[str] = Field(None, description="User ID (nullable for now)")


class AlertCreate(AlertBase):
    """Schema for creating a new alert."""
    pass


class AlertUpdate(BaseModel):
    """Schema for updating an alert."""
    is_active: Optional[bool] = Field(None, description="Whether the alert is active")
    threshold: Optional[float] = Field(None, gt=0, description="Updated threshold value")


class AlertResponse(AlertBase):
    """Schema for alert response."""
    id: int
    is_active: bool
    triggered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class NotificationBase(BaseModel):
    """Base schema for notifications."""
    symbol: str
    message: str
    alert_type: str
    triggered_at: datetime


class NotificationResponse(NotificationBase):
    """Schema for notification response."""
    id: str
    is_read: bool
    
    model_config = ConfigDict(from_attributes=True)
