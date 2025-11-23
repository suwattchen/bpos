#!/bin/bash

# ========================================
# POS System - Ubuntu Deployment Script
# ========================================
# For deploying on Ubuntu Server with Docker + Cloudflare Tunnel

set -e

echo "========================================="
echo "POS System - Ubuntu Deployment"
echo "========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (use sudo)${NC}"
  exit 1
fi

# ========================================
# Step 1: Check System Requirements
# ========================================
echo -e "${YELLOW}Step 1: Checking system requirements...${NC}"

# Check Ubuntu version
if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [[ "$ID" != "ubuntu" ]]; then
    echo -e "${RED}This script is designed for Ubuntu. Current OS: $ID${NC}"
    exit 1
  fi
  echo "✓ Ubuntu $VERSION detected"
else
  echo -e "${RED}Cannot detect OS version${NC}"
  exit 1
fi

# Check available disk space (need at least 10GB)
AVAILABLE_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$AVAILABLE_SPACE" -lt 10 ]; then
  echo -e "${RED}Insufficient disk space. Need at least 10GB, available: ${AVAILABLE_SPACE}GB${NC}"
  exit 1
fi
echo "✓ Disk space: ${AVAILABLE_SPACE}GB available"

# Check RAM (recommend at least 2GB)
TOTAL_RAM=$(free -g | awk 'NR==2 {print $2}')
if [ "$TOTAL_RAM" -lt 2 ]; then
  echo -e "${YELLOW}Warning: Low RAM detected (${TOTAL_RAM}GB). Recommended: 2GB+${NC}"
fi
echo "✓ RAM: ${TOTAL_RAM}GB"

echo ""

# ========================================
# Step 2: Install Docker
# ========================================
echo -e "${YELLOW}Step 2: Installing Docker...${NC}"

if command -v docker &> /dev/null; then
  echo "✓ Docker already installed: $(docker --version)"
else
  echo "Installing Docker..."

  # Update package index
  apt-get update

  # Install prerequisites
  apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

  # Add Docker's official GPG key
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

  # Set up repository
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  # Install Docker
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

  # Start Docker
  systemctl start docker
  systemctl enable docker

  echo "✓ Docker installed successfully"
fi

echo ""

# ========================================
# Step 3: Install Docker Compose
# ========================================
echo -e "${YELLOW}Step 3: Checking Docker Compose...${NC}"

if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
  echo "✓ Docker Compose available"
else
  echo "Installing Docker Compose..."
  apt-get install -y docker-compose
  echo "✓ Docker Compose installed"
fi

echo ""

# ========================================
# Step 4: Configure Environment
# ========================================
echo -e "${YELLOW}Step 4: Configuring environment...${NC}"

# Check if .env.selfhost exists
if [ ! -f .env.selfhost ]; then
  echo -e "${RED}.env.selfhost not found!${NC}"
  exit 1
fi

# Copy to .env if not exists
if [ ! -f .env ]; then
  cp .env.selfhost .env
  echo "✓ Created .env from .env.selfhost"
else
  echo "✓ .env already exists"
fi

# Generate secure passwords if still using defaults
if grep -q "changeme" .env; then
  echo ""
  echo -e "${YELLOW}⚠️  WARNING: Default passwords detected in .env${NC}"
  echo "Please update the following in .env file:"
  echo "  - DB_PASSWORD"
  echo "  - REDIS_PASSWORD"
  echo "  - MINIO_SECRET_KEY"
  echo "  - JWT_SECRET"
  echo ""
  read -p "Have you updated the passwords? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Please update passwords in .env before continuing${NC}"
    exit 1
  fi
fi

echo ""

# ========================================
# Step 5: Setup Cloudflare Tunnel (Optional)
# ========================================
echo -e "${YELLOW}Step 5: Cloudflare Tunnel setup...${NC}"

read -p "Do you want to setup Cloudflare Tunnel? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  if [ ! -d ~/.cloudflared ]; then
    echo "Please follow these steps:"
    echo "1. Install cloudflared:"
    echo "   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb"
    echo "   dpkg -i cloudflared.deb"
    echo ""
    echo "2. Login to Cloudflare:"
    echo "   cloudflared tunnel login"
    echo ""
    echo "3. Create tunnel:"
    echo "   cloudflared tunnel create pos-system"
    echo ""
    echo "4. Update cloudflared-config.yml with your tunnel ID"
    echo ""
    read -p "Press Enter after completing these steps..."
  else
    echo "✓ Cloudflare credentials found"
  fi
fi

echo ""

# ========================================
# Step 6: Pull Docker Images
# ========================================
echo -e "${YELLOW}Step 6: Pulling Docker images...${NC}"

docker compose pull

echo "✓ Images pulled"
echo ""

# ========================================
# Step 7: Build and Start Containers
# ========================================
echo -e "${YELLOW}Step 7: Building and starting containers...${NC}"

# Stop existing containers
docker compose down

# Build and start
docker compose up -d --build

echo "✓ Containers started"
echo ""

# ========================================
# Step 8: Wait for Services
# ========================================
echo -e "${YELLOW}Step 8: Waiting for services to be ready...${NC}"

echo -n "Waiting for PostgreSQL"
for i in {1..30}; do
  if docker exec pos-postgres pg_isready -U pos_admin -d pos_system > /dev/null 2>&1; then
    echo ""
    echo "✓ PostgreSQL ready"
    break
  fi
  echo -n "."
  sleep 2
done

echo -n "Waiting for Backend API"
for i in {1..30}; do
  if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo ""
    echo "✓ Backend API ready"
    break
  fi
  echo -n "."
  sleep 2
done

echo -n "Waiting for Frontend"
for i in {1..30}; do
  if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo ""
    echo "✓ Frontend ready"
    break
  fi
  echo -n "."
  sleep 2
done

echo ""

# ========================================
# Step 9: Verify Installation
# ========================================
echo -e "${YELLOW}Step 9: Verifying installation...${NC}"

# Check container status
RUNNING_CONTAINERS=$(docker compose ps --services --filter "status=running" | wc -l)
echo "✓ Running containers: $RUNNING_CONTAINERS"

# Check database
if docker exec pos-postgres psql -U pos_admin -d pos_system -c "SELECT COUNT(*) FROM tenants" > /dev/null 2>&1; then
  echo "✓ Database accessible"
else
  echo -e "${RED}✗ Database check failed${NC}"
fi

# Check backend API
if curl -sf http://localhost:3001/health | grep -q "ok"; then
  echo "✓ Backend API responding"
else
  echo -e "${YELLOW}⚠ Backend API not responding${NC}"
fi

# Check frontend
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
  echo "✓ Frontend accessible"
else
  echo -e "${YELLOW}⚠ Frontend not accessible${NC}"
fi

echo ""

# ========================================
# Step 10: Display Information
# ========================================
echo -e "${GREEN}========================================="
echo "POS System Deployed Successfully!"
echo "=========================================${NC}"
echo ""
echo "Access URLs:"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3001"
echo "  MinIO:     http://localhost:9001"
echo ""
echo "Default Admin Credentials:"
echo "  Email:     admin@pos.local"
echo "  Password:  admin123"
echo "  ⚠️  CHANGE THIS IMMEDIATELY!"
echo ""
echo "Container Status:"
docker compose ps
echo ""
echo "Useful Commands:"
echo "  View logs:        docker compose logs -f"
echo "  Stop system:      docker compose stop"
echo "  Start system:     docker compose start"
echo "  Restart system:   docker compose restart"
echo "  Stop & remove:    docker compose down"
echo "  Database backup:  docker exec pos-postgres pg_dump -U pos_admin pos_system > backup.sql"
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Cloudflare Tunnel:"
  echo "  Configure DNS records in Cloudflare dashboard"
  echo "  Your tunnel should now be active"
  echo ""
fi

echo -e "${GREEN}Deployment complete!${NC}"
echo ""
