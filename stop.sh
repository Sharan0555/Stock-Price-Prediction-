#!/bin/bash
pkill -f "uvicorn app.main:app" 2>/dev/null && echo "Backend stopped"
pkill -f "next dev" 2>/dev/null && echo "Frontend stopped"
echo "All services stopped"
