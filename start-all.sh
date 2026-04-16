#!/bin/bash
# Start both frontend and backend services

echo "=========================================="
echo "Starting Stock Price Prediction App"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project root
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo -e "${YELLOW}Project root: $PROJECT_ROOT${NC}"

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo -e "${RED}Shutting down services...${NC}"
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    echo -e "${GREEN}Services stopped.${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Check if backend is already running
if lsof -i :8001 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend already running on port 8001${NC}"
else
    echo -e "${YELLOW}→ Starting Backend on port 8001...${NC}"
    cd "$PROJECT_ROOT/backend"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d ".venv" ]; then
        python -m venv .venv
    fi
    
    # Activate and install dependencies
    source .venv/bin/activate
    pip install -r requirements.txt -q
    
    # Start backend in background
    uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload &
    BACKEND_PID=$!
    
    # Wait for backend to be ready
    echo -n "  Waiting for backend to start"
    for i in {1..30}; do
        if curl -s http://localhost:8001/api/v1/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test"}' >/dev/null 2>&1; then
            echo -e "\n${GREEN}✓ Backend started successfully${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
fi

# Check if frontend is already running
if lsof -i :3000 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend already running on port 3000${NC}"
else
    echo -e "${YELLOW}→ Starting Frontend on port 3000...${NC}"
    cd "$PROJECT_ROOT/frontend"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "  Installing npm dependencies..."
        npm install
    fi
    
    # Start frontend in background
    npm run dev &
    FRONTEND_PID=$!
    
    # Wait for frontend to be ready
    echo -n "  Waiting for frontend to start"
    for i in {1..30}; do
        if curl -s http://localhost:3000 >/dev/null 2>&1; then
            echo -e "\n${GREEN}✓ Frontend started successfully${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✓ All services are running!${NC}"
echo "=========================================="
echo ""
echo -e "Frontend: ${GREEN}http://localhost:3000${NC}"
echo -e "Backend:  ${GREEN}http://localhost:8001${NC}"
echo -e "Login:    ${GREEN}http://localhost:3000/auth/login${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep script running
wait
