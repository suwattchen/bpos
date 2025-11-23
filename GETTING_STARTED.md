# 🚀 Getting Started - Self-Hosted POS System

Complete guide to setting up and running your self-hosted POS system.

## 📋 Prerequisites

### System Requirements

- **OS:** Linux (Ubuntu 20.04+, Debian 11+), macOS, or Windows with WSL2
- **RAM:** 2GB minimum, 4GB recommended
- **Disk:** 10GB free space
- **CPU:** 2 cores minimum

### Required Software

```bash
# Docker & Docker Compose
docker --version  # Should be 20.10+
docker compose version  # Should be 2.0+

# If not installed:
# Ubuntu/Debian:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# macOS:
# Download Docker Desktop from docker.com

# Windows:
# Install WSL2 + Docker Desktop
```

---

## ⚡ Quick Installation

### Step 1: Clone Repository

```bash
git clone <your-repository-url>
cd pos-system
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Generate secure passwords
openssl rand -base64 32  # Use for DB_PASSWORD
openssl rand -base64 32  # Use for REDIS_PASSWORD
openssl rand -base64 32  # Use for MINIO_SECRET_KEY
openssl rand -base64 48  # Use for JWT_SECRET

# Edit .env file
nano .env  # or use your preferred editor
```

**Required changes in `.env`:**

```bash
# Database
DB_PASSWORD=<your-generated-password>

# Redis
REDIS_PASSWORD=<your-generated-password>

# MinIO
MINIO_SECRET_KEY=<your-generated-password>

# Backend
JWT_SECRET=<your-generated-secret-min-48-chars>

# Frontend (adjust if needed)
VITE_API_URL=http://localhost:3001
```

### Step 3: Start Services

```bash
# Start all containers
docker compose up -d

# Check status
docker compose ps

# Expected output:
# pos-postgres    - running
# pos-redis       - running
# pos-minio       - running
# pos-backend     - running
# pos-frontend    - running
# pos-npm         - running
```

### Step 4: Initialize Database

```bash
# Wait for PostgreSQL to be ready (30-60 seconds)
docker compose logs postgres | grep "ready to accept connections"

# Initialize database schema
docker exec -i pos-postgres psql -U pos_admin -d pos_system < database/init/01-init.sql

# Expected output: CREATE TABLE, CREATE INDEX, etc.
```

### Step 5: Create Admin User

```bash
# Using the script
./scripts/create-admin.sh admin@yourcompany.com YourSecurePassword123

# Or manually via SQL
docker exec -i pos-postgres psql -U pos_admin -d pos_system <<EOF
-- Will be created automatically on first signup
EOF
```

### Step 6: Access Application

```bash
# Frontend: http://localhost
# Backend API: http://localhost:3001
# Nginx Proxy Manager: http://localhost:81
#   Default: admin@example.com / changeme (CHANGE THIS!)
```

---

## 🔧 Configuration Details

### Frontend Configuration

Edit `.env`:

```bash
# API endpoint (adjust for production)
VITE_API_URL=http://localhost:3001

# For production with domain:
# VITE_API_URL=https://api.yourdomain.com
```

### Backend Configuration

```bash
# Server
NODE_ENV=production
PORT=3001

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=pos_system
DB_USER=pos_admin
DB_PASSWORD=<secure-password>

# Authentication
JWT_SECRET=<min-48-chars-secret>
JWT_EXPIRATION=7d

# CORS (adjust for production)
CORS_ORIGIN=http://localhost:3000

# File Upload
MAX_FILE_SIZE=10485760  # 10MB

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### Docker Compose Customization

Edit `docker-compose.yml` to customize:

```yaml
services:
  frontend:
    build:
      args:
        VITE_API_URL: ${VITE_API_URL:-http://localhost:3001}

  backend:
    environment:
      PORT: ${PORT:-3001}
      # Add more environment variables as needed

  postgres:
    ports:
      - "5433:5432"  # Change if port 5432 is in use

  npm:
    ports:
      - "80:80"      # HTTP
      - "443:443"    # HTTPS
      - "81:81"      # Admin panel
```

---

## 🎯 First Steps After Installation

### 1. Secure Nginx Proxy Manager

```bash
# Access: http://localhost:81
# Default: admin@example.com / changeme

# Steps:
1. Login with default credentials
2. Go to Users → Change Password
3. Update email if needed
4. Enable 2FA (recommended)
```

### 2. Create First Account

```bash
# Via frontend: http://localhost
1. Click "Sign Up"
2. Enter email and password
3. First user becomes tenant admin
```

### 3. Add Products

```bash
# Via API:
curl -X POST http://localhost:3001/api/products \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sample Product",
    "sku": "SKU001",
    "barcode": "1234567890",
    "cost_price": 50,
    "selling_price": 100,
    "tax_rate": 7,
    "is_active": true
  }'
```

### 4. Configure Categories

```bash
curl -X POST http://localhost:3001/api/categories \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Electronics",
    "description": "Electronic devices and accessories"
  }'
```

---

## 🌐 Production Setup

### Setup Domain & SSL

1. **Configure DNS:**
   ```
   A Record: yourdomain.com → Your-Server-IP
   A Record: api.yourdomain.com → Your-Server-IP
   ```

2. **Add Proxy Host in Nginx Proxy Manager:**
   - Access: http://your-server:81
   - Add Proxy Host:
     - Domain: `yourdomain.com`
     - Forward to: `frontend` port `80`
   - SSL Tab:
     - Request Let's Encrypt Certificate
     - Force SSL: ON
     - HTTP/2 Support: ON

3. **Update Frontend Environment:**
   ```bash
   # Edit .env
   VITE_API_URL=https://api.yourdomain.com

   # Rebuild frontend
   docker compose build frontend
   docker compose up -d frontend
   ```

### Firewall Configuration

```bash
# Ubuntu/Debian with ufw
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 81/tcp   # NPM Admin (restrict to your IP in production)
sudo ufw enable

# Block direct access to internal services
sudo ufw deny 3001  # Backend
sudo ufw deny 5432  # PostgreSQL
sudo ufw deny 6379  # Redis
sudo ufw deny 9000  # MinIO
```

---

## 🔍 Verification

### Health Checks

```bash
# Backend health
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"..."}

# Database connection
docker exec pos-postgres psql -U pos_admin -d pos_system -c "SELECT NOW();"

# Redis connection
docker exec pos-redis redis-cli -a ${REDIS_PASSWORD} PING
# Expected: PONG

# Frontend
curl http://localhost
# Should return HTML
```

### Check Logs

```bash
# All services
docker compose logs --tail=50

# Specific service
docker compose logs -f backend
docker compose logs -f postgres

# Search for errors
docker compose logs | grep -i error
```

### Test Database

```bash
# Connect to database
docker exec -it pos-postgres psql -U pos_admin -d pos_system

# Check tables
\dt

# Expected tables:
# - tenants
# - tenant_users
# - products
# - categories
# - inventory
# - customers
# - transactions
# - transaction_items
```

---

## 🛠 Common Issues & Solutions

### Issue: Services Won't Start

```bash
# Check logs
docker compose logs

# Common causes:
# 1. Port already in use
docker compose ps  # Check conflicting ports
sudo lsof -i :80   # Check what's using port 80

# 2. Insufficient memory
free -h  # Check available RAM
docker stats  # Check container memory usage

# Solution: Stop conflicting services or adjust ports
```

### Issue: Database Connection Failed

```bash
# Check PostgreSQL status
docker compose ps postgres

# Check credentials
cat .env | grep DB_

# Test connection
docker exec pos-postgres psql -U pos_admin -d pos_system -c "SELECT 1;"

# Reset if needed
docker compose restart postgres
```

### Issue: Frontend Can't Connect to Backend

```bash
# Check VITE_API_URL
cat .env | grep VITE_API_URL

# Should match backend URL
# Development: http://localhost:3001
# Production: https://api.yourdomain.com

# Rebuild frontend after changes
docker compose build frontend
docker compose up -d frontend
```

### Issue: Upload Files Not Working

```bash
# Check MinIO is running
docker compose ps minio

# Access MinIO console
# http://localhost:9002

# Create bucket if missing
docker exec pos-minio mc mb local/product-images
docker exec pos-minio mc policy set public local/product-images
```

---

## 📊 Monitoring

### View Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

### Database Maintenance

```bash
# Backup
docker exec pos-postgres pg_dump -U pos_admin pos_system > backup-$(date +%Y%m%d).sql

# Restore
docker exec -i pos-postgres psql -U pos_admin -d pos_system < backup-20250101.sql

# Vacuum database
docker exec pos-postgres psql -U pos_admin -d pos_system -c "VACUUM ANALYZE;"
```

---

## 📚 Next Steps

- [SELF_HOST_GUIDE.md](./SELF_HOST_GUIDE.md) - Advanced self-hosting guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [backend/TESTING_GUIDE.md](./backend/TESTING_GUIDE.md) - Testing guide
- [README.md](./README.md) - Main documentation

---

## 🆘 Need Help?

1. Check logs: `docker compose logs`
2. Verify configuration: `cat .env`
3. Test health endpoints
4. Review troubleshooting section above

**System Status:** ✅ Self-Hosted, 100% Independent, Production-Ready
