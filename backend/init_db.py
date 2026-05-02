#!/usr/bin/env python3
"""Initialize database tables for testing"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.postgres import engine, Base
from app.models.alert import Alert

def init_db():
    """Create all database tables"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

if __name__ == "__main__":
    init_db()
