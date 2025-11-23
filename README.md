# 🏪 Multi-Tenant POS System (Self-Hosted)

A production-ready Point of Sale system with multi-tenant support, built for self-hosting with React, TypeScript, Node.js, and PostgreSQL.

**🎯 Status**: Ready for deployment - All self-hosting requirements complete, Docker configuration tested, API endpoints verified.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Production Deployment](#production-deployment)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

---

## ✨ Features

### Core Functionality
- ✅ **Product Management** - CRUD operations with categories, images, and inventory tracking
- ✅ **Point of Sale** - Fast checkout with barcode scanning and receipt printing
- ✅ **Inventory Management** - Real-time stock tracking with low-stock alerts
- ✅ **Customer Management** - Customer profiles with loyalty points and purchase history
- ✅ **Sales Analytics** - Daily, weekly, monthly reports with revenue tracking
- ✅ **Multi-Tenant** - Complete data isolation between tenants
- ✅ **Offline Mode** - PWA with offline capability

### Technical Features
- ✅ **Self-Hosted** - 100% self-contained, no external dependencies
- ✅ **Authentication** - JWT-based auth with bcrypt password hashing
- ✅ **File Storage** - S3-compatible storage with MinIO
- ✅ **Database** - PostgreSQL with Row Level Security (RLS)
- ✅ **API** - RESTful API with comprehensive error handling
- ✅ **Docker** - Full containerization for easy deployment
- ✅ **TypeScript** - Type-safe frontend and backend
- ✅ **Nginx Proxy Manager** - Reverse proxy with SSL/TLS support

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Nginx Proxy Manager                       │
│                  (Port 80, 443, Admin 81)                   │
└────────────────────────┬───────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    ┌────▼─────┐                   ┌────▼─────┐
    │ Frontend │                   │ Backend  │
    │  (React) │                   │ (Node.js)│
    │  Port 80 │                   │ Port 3001│
    └──────────┘                   └────┬─────┘
                                        │
         ┌──────────────┬───────────────┼──────────────┐
         │              │               │              │
    ┌────▼────┐   ┌────▼────┐    ┌────▼────┐   ┌────▼────┐
    │PostgreSQL│   │  Redis  │    │  MinIO  │   │  Logs   │
    │Port 5432│   │Port 6379│    │Port 9000│   │ Volume  │
    └─────────┘   └─────────┘    └─────────┘   └─────────┘
```

**Key Points:**
- Frontend → Backend REST API (no direct database access)
- Backend handles all business logic and database operations
- All services run in isolated Docker containers
- Data persisted in Docker volumes

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- 2GB RAM minimum
- 10GB disk space

### Installation

```bash
# 1. Clone repository
git clone <repository-url>
cd pos-system

# 2. Configure environment
cp .env.example .env

# IMPORTANT: Edit .env and change ALL passwords!
nano .env

# 3. Start all services
docker compose up -d

# 4. Wait for services to be ready (30-60 seconds)
docker compose logs -f

# 5. Initialize database
docker exec -i pos-postgres psql -U pos_admin -d pos_system < database/init/01-init.sql

# 6. Create admin user
./scripts/create-admin.sh admin@example.com SecurePassword123

# 7. Access the application
# http://localhost (or your domain)
# Nginx Proxy Manager: http://localhost:81
# Default: admin@example.com / changeme
```

---

## ⚙️ Configuration

### Environment Variables

Edit `.env` file:

```bash
# Database
DB_NAME=pos_system
DB_USER=pos_admin
DB_PASSWORD=<change-this-secure-password>

# Backend API
PORT=3001
JWT_SECRET=<change-this-min-32-chars-secret>
JWT_EXPIRATION=7d
CORS_ORIGIN=http://localhost:3000

# Redis Cache
REDIS_PASSWORD=<change-this-password>

# MinIO Object Storage
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=<change-this-password>

# Frontend
VITE_API_URL=http://localhost:3001
```

### Generate Secure Passwords

```bash
# Generate random passwords
openssl rand -base64 32  # For DB_PASSWORD, REDIS_PASSWORD, MINIO_SECRET_KEY
openssl rand -base64 48  # For JWT_SECRET
```

### ⚠️ Security Requirements

**BEFORE PRODUCTION:**
1. Change ALL default passwords
2. Use strong JWT_SECRET (min 32 characters)
3. Enable HTTPS via Nginx Proxy Manager
4. Configure firewall rules
5. Set up regular backups

---

## 🌐 Production Deployment

### Using Nginx Proxy Manager (Recommended)

1. Access Nginx Proxy Manager at `http://your-server:81`
2. Default login: `admin@example.com` / `changeme`
3. Add Proxy Host:
   - Domain: `your-domain.com`
   - Forward to: `frontend` port `80`
4. Add SSL Certificate (Let's Encrypt)
5. Configure DNS to point to your server

### Port Configuration

- **80** - HTTP (handled by Nginx Proxy Manager)
- **443** - HTTPS (handled by Nginx Proxy Manager)
- **81** - Nginx Proxy Manager Admin Panel
- **3001** - Backend API (internal only)
- **5432** - PostgreSQL (internal only)
- **9000** - MinIO (internal only)

### Health Checks

```bash
# Check all services
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Test backend health
curl http://localhost:3001/health

# Test frontend
curl http://localhost
```

---

## 📚 API Documentation

### Authentication

```bash
# Signup
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'

# Response: { "token": "...", "user": {...}, "tenantId": "...", "role": "..." }
```

### Using API with Token

```bash
# Get all products
curl http://localhost:3001/api/products \
  -H "Authorization: Bearer <your-token>"

# Create product
curl -X POST http://localhost:3001/api/products \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Name",
    "sku": "SKU001",
    "selling_price": 100,
    "cost_price": 50
  }'
```

### API Endpoints

- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `GET /api/inventory` - List inventory
- `POST /api/inventory/update` - Update stock
- `GET /api/customers` - List customers
- `POST /api/transactions` - Create transaction
- `GET /api/sales/summary` - Sales reports

---

## 🐛 Troubleshooting

### Services won't start

```bash
# Check logs
docker compose logs

# Restart services
docker compose restart

# Full reset
docker compose down
docker compose up -d
```

### Database connection error

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Connect to database
docker exec -it pos-postgres psql -U pos_admin -d pos_system

# Verify credentials in .env
```

### Frontend can't connect to backend

```bash
# Check VITE_API_URL in .env
# Should match backend URL: http://localhost:3001

# Rebuild frontend
docker compose build frontend
docker compose up -d frontend
```

### MinIO storage issues

```bash
# Access MinIO console
# http://localhost:9002 (or port in docker-compose.yml)

# Verify bucket exists
docker exec pos-minio mc ls local/

# Create bucket if needed
docker exec pos-minio mc mb local/product-images
```

---

## 📖 Additional Documentation

- [GETTING_STARTED.md](./GETTING_STARTED.md) - Detailed setup guide
- [SELF_HOST_GUIDE.md](./SELF_HOST_GUIDE.md) - Self-hosting best practices
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture details
- [backend/TESTING_GUIDE.md](./backend/TESTING_GUIDE.md) - Testing guide

---

## 🔧 Development

```bash
# Frontend development
npm install
npm run dev

# Backend development
cd backend
npm install
npm run dev

# Build for production
npm run build
cd backend && npm run build
```

---

## 📊 Monitoring

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f postgres
```

### Database Backups

```bash
# Backup
docker exec pos-postgres pg_dump -U pos_admin pos_system > backup.sql

# Restore
docker exec -i pos-postgres psql -U pos_admin -d pos_system < backup.sql
```

---

## 📄 License

MIT License

---

**Status:** ✅ Production Ready (Self-Hosted) | **Version:** 2.0.0 | **Architecture:** 100% Self-Contained
