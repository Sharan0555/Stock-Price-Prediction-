#!/bin/bash
echo "Checking services..."
brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || echo "Start Postgres manually"
brew services start mongodb-community 2>/dev/null || echo "Start MongoDB manually"
brew services start redis 2>/dev/null || echo "Redis optional - in-memory fallback active"
echo "Creating stocks database..."
createdb stocks 2>/dev/null || echo "Database already exists"
echo "Done"
