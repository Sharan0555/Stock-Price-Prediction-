"""
Migration script to create the alerts table in PostgreSQL.
This script can be run manually or integrated with Alembic.
"""

import sys
import os
from sqlalchemy import text

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.postgres import engine
from app.models.alert import Alert


def create_alerts_table():
    """Create the alerts table using SQLAlchemy model."""
    try:
        # Import Base to ensure the model is registered
        from app.db.postgres import Base
        
        # Create the table
        Alert.__table__.create(engine, checkfirst=True)
        print("Alerts table created successfully!")
        
        # Verify the table was created
        with engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM alerts"))
            count = result.scalar()
            print(f"Alerts table verified. Current record count: {count}")
            
    except Exception as e:
        print(f"Error creating alerts table: {e}")
        raise


if __name__ == "__main__":
    create_alerts_table()
