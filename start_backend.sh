#!/bin/bash
echo "Killing any process on port 8001..."
lsof -ti:8001 | xargs kill -9 2>/dev/null || true
sleep 1
echo "Starting backend..."
cd backend && ./.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
