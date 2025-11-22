# 🏪 Multi-Tenant POS System

A production-ready Point of Sale system with multi-tenant support, built with React, TypeScript, Node.js, and PostgreSQL.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Testing](#testing)
- [Security](#security)
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
- ✅ **Offline Mode** - PWA with offline capability and sync

### Technical Features
- ✅ **Authentication** - JWT-based auth with bcrypt password hashing
- ✅ **File Storage** - S3-compatible storage with MinIO
- ✅ **Database** - PostgreSQL with Row Level Security (RLS)
- ✅ **API** - RESTful API with comprehensive error handling
- ✅ **Docker** - Full containerization for easy deployment
- ✅ **TypeScript** - Type-safe frontend and backend

---

## 🚀 Quick Start

### Option 1: Development with Supabase (5 minutes)

```bash
# 1. Clone and install
git clone <repository-url>
cd pos-system
npm install

# 2. Setup Supabase
# - Go to https://supabase.com
# - Create new project
# - Run database_setup.sql in SQL Editor

# 3. Configure environment
cp .env.example .env
# Add: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 4. Start
npm run dev
```

### Option 2: Self-Hosted with Docker (15 minutes)

```bash
# 1. Setup
cp .env.selfhost .env
# IMPORTANT: Change all passwords!

# 2. Start services
docker-compose up -d

# 3. Initialize database
sleep 30
docker exec -i pos-postgres psql -U pos_admin -d pos_system < database_setup.sql

# 4. Verify
./scripts/test-deployment.sh

# 5. Access http://localhost:3000
```

---

## 🔐 Security

### ⚠️ REQUIRED: Change Default Passwords

```bash
# Generate secure values
openssl rand -base64 32  # For passwords
openssl rand -base64 48  # For JWT_SECRET

# Update .env:
DB_PASSWORD=<generated-password>
REDIS_PASSWORD=<generated-password>
MINIO_SECRET_KEY=<generated-password>
JWT_SECRET=<generated-secret>
```

The system will **refuse to start** with default values in production.

---

## 🧪 Testing

```bash
# Frontend
npm test                    # Run tests
npm run test:coverage       # With coverage
npm run test:e2e            # E2E tests

# Backend
cd backend
npm test                    # Run tests
npm run test:integration    # Integration tests
```

**CI/CD:** GitHub Actions runs tests on every push/PR

---

## 📚 API Documentation

### Quick Example

```bash
# Signup
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456"}'

# Response: { "token": "...", "user": {...} }

# Use token for authenticated requests
curl http://localhost:3001/products \
  -H "Authorization: Bearer <token>"
```

**Full API Docs:** See [docs/API.md](./docs/API.md)

---

## 🐛 Troubleshooting

### Services won't start
```bash
docker-compose logs
docker-compose restart
```

### Can't connect to database
```bash
docker exec -it pos-postgres psql -U pos_admin -d pos_system
# Verify .env credentials
```

### Frontend errors
```bash
# Check VITE_API_URL in .env
# Should be: http://localhost:3001
```

**More:** [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)

---

## 📖 Documentation

- [Architecture](./ARCHITECTURE.md) - System design
- [Deployment Guide](./FINAL_DEPLOYMENT_GUIDE.md) - Production setup
- [API Reference](./docs/API.md) - Complete API docs
- [Contributing](./CONTRIBUTING.md) - Development guide

---

## 📄 License

MIT License

---

**Status:** ✅ Production Ready | **Version:** 1.0.0
