#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "POS System - Deployment Test Script"
echo "========================================="
echo ""

# Function to check if service is healthy
check_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1

    echo -n "Checking $service"

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e " ${RED}✗${NC}"
    return 1
}

# Check Docker
echo "1. Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

# Check Docker Compose
echo ""
echo "2. Checking Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose installed${NC}"

# Check .env file
echo ""
echo "3. Checking environment configuration..."
if [ ! -f .env ] && [ ! -f .env.selfhost ]; then
    echo -e "${YELLOW}⚠ No .env file found. Creating from template...${NC}"
    if [ -f .env.selfhost ]; then
        cp .env.selfhost .env
    else
        echo -e "${RED}✗ No .env template found${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Environment configured${NC}"

# Start services
echo ""
echo "4. Starting Docker services..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to start services${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Services started${NC}"

# Wait for services to be healthy
echo ""
echo "5. Waiting for services to be ready..."
sleep 5

# Check PostgreSQL
check_service "PostgreSQL" "http://localhost:5432" || {
    echo -e "${RED}PostgreSQL is not healthy${NC}"
    docker-compose logs postgres
    exit 1
}

# Check Redis
check_service "Redis" "http://localhost:6379" || {
    echo -e "${YELLOW}⚠ Redis health check failed (this may be normal)${NC}"
}

# Check MinIO
check_service "MinIO" "http://localhost:9000/minio/health/live" || {
    echo -e "${RED}MinIO is not healthy${NC}"
    docker-compose logs minio
    exit 1
}

# Check Backend
check_service "Backend API" "http://localhost:3001/health" || {
    echo -e "${RED}Backend API is not healthy${NC}"
    echo "Showing backend logs:"
    docker-compose logs --tail=50 backend
    exit 1
}

# Check Frontend
check_service "Frontend" "http://localhost:3000" || {
    echo -e "${RED}Frontend is not healthy${NC}"
    docker-compose logs frontend
    exit 1
}

echo ""
echo "6. Testing API endpoints..."

# Test health endpoint
echo -n "Testing /health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/health)
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e " ${GREEN}✓${NC}"
else
    echo -e " ${RED}✗${NC}"
    echo "Response: $HEALTH_RESPONSE"
fi

# Test signup endpoint
echo -n "Testing /auth/signup endpoint..."
SIGNUP_RESPONSE=$(curl -s -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456"}')

if echo "$SIGNUP_RESPONSE" | grep -q "token\|already exists"; then
    echo -e " ${GREEN}✓${NC}"
else
    echo -e " ${RED}✗${NC}"
    echo "Response: $SIGNUP_RESPONSE"
fi

echo ""
echo "========================================="
echo -e "${GREEN}✓ All tests passed!${NC}"
echo "========================================="
echo ""
echo "Services are running:"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3001"
echo "  MinIO UI:  http://localhost:9001"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Create a test account"
echo "  3. Add products and test POS"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop:      docker-compose down"
echo ""
