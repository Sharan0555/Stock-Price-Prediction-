from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.sql import func

from app.db.postgres import Base


class Alert(Base):
    """Alert model for price and volatility notifications."""
    
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)  # Nullable for now
    symbol = Column(String(10), nullable=False, index=True)  # e.g. "AAPL"
    alert_type = Column(String(20), nullable=False)  # "price_above", "price_below", "volatility"
    threshold = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    triggered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    def __repr__(self) -> str:
        return f"Alert(id={self.id}, symbol={self.symbol}, type={self.alert_type}, threshold={self.threshold})"
