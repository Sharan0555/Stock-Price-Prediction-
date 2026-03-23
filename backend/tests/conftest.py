from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
project_root_str = str(PROJECT_ROOT)
if project_root_str not in sys.path:
    sys.path.insert(0, project_root_str)

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """Runs FastAPI lifespan so app.state (e.g. live_price_service) is initialized."""
    with TestClient(app) as c:
        yield c
