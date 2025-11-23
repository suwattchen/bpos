# 🚀 Quick Deploy Guide

## Prerequisites
- Docker and Docker Compose installed
- Ports 80, 443, 81 available
- Minimum 2GB RAM, 10GB disk space

## 5-Minute Deployment

### Step 1: Update Security Credentials
```bash
# Edit .env file
nano .env

# Change these values (REQUIRED):
DB_PASSWORD=your_secure_password_here
REDIS_PASSWORD=your_secure_redis_password
JWT_SECRET=your_secure_jwt_secret_min_32_chars_long_change_this
MINIO_SECRET_KEY=your_secure_minio_password_change_this
```

### Step 2: Build and Start
```bash
# Build all containers
docker compose build

# Start all services
docker compose up -d

# Watch logs (optional)
docker compose logs -f
```

### Step 3: Verify Deployment
```bash
# Check all containers are running
docker compose ps

# Test health endpoint
curl http://localhost/health
# Expected: "ok"

# Test backend health
curl http://localhost/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Step 4: Test Basic Flow
```bash
# 1. Create account via browser
# Open: http://localhost

# 2. Or test with curl
curl -X POST http://localhost/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!",
    "name": "Admin User"
  }'

# 3. Login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin123!"
  }'
# Save the "token" from response
```

## Access Points

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| Frontend | http://localhost | (Create via signup) |
| Backend API | http://localhost/api | - |
| Nginx Proxy Manager | http://localhost:81 | admin@example.com / changeme |
| MinIO Console | http://localhost:9003 | minioadmin / (from .env) |

## Quick Commands

```bash
# Stop all services
docker compose down

# Stop and remove volumes (CAUTION: deletes all data)
docker compose down -v

# Restart single service
docker compose restart backend

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Check database
docker compose exec postgres psql -U pos_admin -d pos_system

# Backup database
docker compose exec postgres pg_dump -U pos_admin pos_system > backup.sql

# Restore database
docker compose exec -T postgres psql -U pos_admin -d pos_system < backup.sql
```

## Production Setup

### 1. Domain Configuration
Edit `.env`:
```bash
CORS_ORIGIN=https://yourdomain.com
```

Restart backend:
```bash
docker compose restart backend
```

### 2. SSL Configuration (via Nginx Proxy Manager)
1. Access NPM at http://localhost:81
2. Go to "Proxy Hosts" → "Add Proxy Host"
3. Configure:
   - **Domain Names**: yourdomain.com
   - **Scheme**: http
   - **Forward Hostname**: frontend
   - **Forward Port**: 80
4. Go to "SSL" tab:
   - Enable "Force SSL"
   - Select "Request a new SSL Certificate"
   - Enable "Force SSL"
   - Email: your@email.com
   - Agree to Terms
5. Save

### 3. Configure Backend Proxy (in NPM)
Add another proxy host:
- **Domain**: api.yourdomain.com (or use path /api)
- **Forward Hostname**: backend
- **Forward Port**: 3001
- Enable SSL same as above

Update `.env`:
```bash
VITE_API_URL=https://api.yourdomain.com
# OR keep /api if using path-based routing
```

## Architecture Flow

```
Internet
    ↓
Nginx Proxy Manager (:80/:443)
    ↓
    ├─→ /api/* → Backend (:3001)
    │              ↓
    │              ├─→ PostgreSQL (:5432)
    │              ├─→ Redis (:6379)
    │              └─→ MinIO (:9000)
    │
    └─→ /* → Frontend (:80)
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Products
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Inventory
- `GET /api/inventory` - List inventory
- `POST /api/inventory/update` - Update stock
- `POST /api/inventory/adjust` - Adjust stock
- `GET /api/inventory/alerts/low-stock` - Low stock alerts

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create sale
- `GET /api/transactions/:id` - Get transaction details
- `GET /api/transactions/reports/sales` - Sales report

### Upload
- `POST /api/upload/product-image` - Upload product image

## Troubleshooting

### Container won't start
```bash
# Check logs
docker compose logs [service-name]

# Common fixes
docker compose down
docker compose up -d
```

### Database connection failed
```bash
# Check postgres is running
docker compose ps postgres

# Check logs
docker compose logs postgres

# Verify credentials in .env match docker-compose.yml
```

### "Cannot connect to API"
```bash
# Check backend is running
docker compose ps backend

# Test backend directly
docker compose exec backend curl http://localhost:3001/health

# Check nginx proxy
docker compose logs npm
```

### CORS errors
1. Check `CORS_ORIGIN` in `.env`
2. Restart backend: `docker compose restart backend`
3. Clear browser cache
4. Check browser console for actual origin

## Monitoring

```bash
# Check disk usage
docker system df

# Check container resources
docker stats

# Check database size
docker compose exec postgres psql -U pos_admin -d pos_system \
  -c "SELECT pg_size_pretty(pg_database_size('pos_system'));"
```

## Maintenance

### Regular Tasks
- Backup database daily
- Monitor disk space
- Check logs for errors
- Update Docker images monthly

### Backup Script
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker compose exec postgres pg_dump -U pos_admin pos_system > backup_$DATE.sql
echo "Backup created: backup_$DATE.sql"
```

## Support

For detailed documentation:
- See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for comprehensive deployment guide
- See [SELF_HOST_GUIDE.md](./SELF_HOST_GUIDE.md) for production best practices
- See [GETTING_STARTED.md](./GETTING_STARTED.md) for development setup

## License

MIT License - See LICENSE file for details
