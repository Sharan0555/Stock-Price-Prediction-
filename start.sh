#!/bin/bash
echo "Starting backend..."
cd backend && source .venv/bin/activate 2>/dev/null; bash start.sh &
echo "Starting frontend..."
cd ../frontend && bash start.sh &
echo ""
echo "App running at http://localhost:3000"
echo "API docs at http://localhost:8001/api/docs"
wait
