# 🚀 Complete Self-Host Deployment Guide

## ✅ System Status: READY TO DEPLOY

**Backend API:** ✅ 100% Complete
**Frontend:** ✅ 100% Complete
**Infrastructure:** ✅ 100% Complete
**Documentation:** ✅ 100% Complete

---

## 📦 What's Included

### Backend API (Complete)
```
✅ Express server with TypeScript
✅ PostgreSQL connection pool
✅ JWT authentication
✅ All CRUD routes:
   - Auth (signup, login, logout)
   - Products (CRUD + search)
   - Inventory (get, adjust, low-stock alerts)
   - Transactions (create, list, reports)
   - Customers (CRUD + search)
   - Categories (CRUD)
   - Upload (MinIO integration)
✅ Error handling
✅ Request validation
✅ Health checks
```

### Frontend
```
✅ React + Vite + TypeScript
✅ API client (axios)
✅ All components ready
✅ PWA support
✅ Offline mode
✅ Responsive design
```

### Infrastructure
```
✅ Docker Compose orchestration
✅ PostgreSQL 15
✅ Redis caching
✅ MinIO S3-compatible storage
✅ Nginx reverse proxy
✅ Health checks for all services
```

---

## 🎯 Quick Start (15 minutes)

### Prerequisites
- Docker 24.0+
- Docker Compose 2.20+
- 4GB RAM minimum
- 20GB disk space

### Step 1: Clone and Setup
```bash
# Clone repository
git clone <your-repo>
cd pos-system

# Copy environment template
cp .env.selfhost .env

# IMPORTANT: Edit .env and change ALL passwords!
nano .env
```

### Step 2: Generate Secure Passwords
```bash
# Generate strong passwords
echo "DB_PASSWORD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
echo "MINIO_SECRET_KEY=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 48)"

# Copy these to your .env file
```

### Step 3: Start Services
```bash
# Build and start all services
docker-compose up -d

# This will start:
# - PostgreSQL (port 5432)
# - Redis (port 6379)
# - MinIO (ports 9000, 9001)
# - Backend API (port 3001)
# - Frontend (port 3000)
# - Nginx (ports 80, 443)
```

### Step 4: Initialize Database
```bash
# Wait for PostgreSQL to be ready (30 seconds)
sleep 30

# Run database setup
docker exec -i pos-postgres psql -U pos_admin -d pos_system < database_setup.sql

# Verify tables created
docker exec -it pos-postgres psql -U pos_admin -d pos_system -c "\dt"
```

### Step 5: Test Deployment
```bash
# Run automated tests
./scripts/test-deployment.sh

# Manual tests:
curl http://localhost:3001/health
curl http://localhost:3000
```

### Step 6: Access Application
```
Open: http://localhost:3000

1. Click "Sign Up"
2. Enter email and password
3. Start using!
```

---

## 🔧 Configuration

### Environment Variables (.env)

**Required (Must Change):**
```bash
DB_PASSWORD=your_secure_database_password_16chars
REDIS_PASSWORD=your_secure_redis_password
MINIO_SECRET_KEY=your_secure_minio_password_16chars
JWT_SECRET=your_jwt_secret_minimum_32_characters
```

**Optional (Can Keep Default):**
```bash
NODE_ENV=production
PORT=3001
DB_NAME=pos_system
DB_USER=pos_admin
CORS_ORIGIN=http://localhost:3000
JWT_EXPIRATION=7d
```

### Port Mapping

| Service | Internal Port | External Port | URL |
|---------|---------------|---------------|-----|
| Frontend | 80 | 3000 | http://localhost:3000 |
| Backend API | 3001 | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | 5432 | localhost:5432 |
| Redis | 6379 | 6379 | localhost:6379 |
| MinIO API | 9000 | 9000 | http://localhost:9000 |
| MinIO Console | 9001 | 9001 | http://localhost:9001 |
| Nginx | 80/443 | 80/443 | http://localhost |

---

## 📊 API Endpoints

### Authentication
```
POST   /auth/signup       # Create account
POST   /auth/login        # Login
POST   /auth/logout       # Logout
GET    /auth/me           # Get current user
```

### Products
```
GET    /products          # List all products
GET    /products/:id      # Get single product
GET    /products/search/:query  # Search products
POST   /products          # Create product
PUT    /products/:id      # Update product
DELETE /products/:id      # Delete product
```

### Inventory
```
GET    /inventory         # List all inventory
GET    /inventory/:productId  # Get product stock
GET    /inventory/alerts/low-stock  # Low stock alert
POST   /inventory/adjust  # Adjust stock
POST   /inventory/set     # Set absolute stock
```

### Transactions
```
GET    /transactions      # List transactions
GET    /transactions/:id  # Get transaction details
POST   /transactions      # Create sale
GET    /transactions/reports/sales  # Sales report
```

### Customers
```
GET    /customers         # List customers
GET    /customers/search  # Search customers
GET    /customers/:id     # Get customer
GET    /customers/:id/transactions  # Customer history
POST   /customers         # Create customer
PUT    /customers/:id     # Update customer
DELETE /customers/:id     # Delete customer
```

### Categories
```
GET    /categories        # List categories
POST   /categories        # Create category
PUT    /categories/:id    # Update category
DELETE /categories/:id    # Delete category
```

### Upload
```
POST   /upload/product-image  # Upload single image
POST   /upload/multiple       # Upload multiple images
DELETE /upload/:fileName      # Delete file
GET    /upload/presigned/:fileName  # Get presigned URL
GET    /upload/list              # List files
```

### Health
```
GET    /health            # System health check
```

---

## 🔍 Monitoring

### Check Service Status
```bash
# All services
docker-compose ps

# Specific service
docker-compose ps backend

# View logs
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs --tail=100 backend
```

### Health Checks
```bash
# Backend API
curl http://localhost:3001/health

# PostgreSQL
docker exec pos-postgres pg_isready -U pos_admin

# Redis
docker exec pos-redis redis-cli -a YOUR_PASSWORD ping

# MinIO
curl http://localhost:9000/minio/health/live

# Frontend
curl http://localhost:3000
```

### Resource Usage
```bash
# CPU and Memory
docker stats

# Disk usage
docker system df

# Detailed info
docker system df -v
```

---

## 🔐 Security

### SSL/HTTPS Setup (Production)
```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ./nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ./nginx/ssl/key.pem

# Update nginx config
nano nginx/nginx.conf
# Uncomment HTTPS server block

# Restart nginx
docker-compose restart nginx
```

### Firewall Configuration
```bash
# Ubuntu/Debian
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# Close other ports
sudo ufw deny 5432/tcp   # PostgreSQL
sudo ufw deny 6379/tcp   # Redis
sudo ufw deny 9000/tcp   # MinIO API
```

### Password Security
```bash
# Change default passwords in .env
DB_PASSWORD=<strong-password-16-chars>
REDIS_PASSWORD=<strong-password>
MINIO_SECRET_KEY=<strong-password-16-chars>
JWT_SECRET=<random-string-32-chars>

# Restart services
docker-compose down
docker-compose up -d
```

---

## 💾 Backup & Restore

### Automated Backup
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
docker exec pos-postgres pg_dump -U pos_admin pos_system | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup MinIO data
docker run --rm -v pos_minio_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/minio_$DATE.tar.gz /data

echo "Backup completed: $DATE"
EOF

chmod +x backup.sh

# Add to cron (daily at 2 AM)
echo "0 2 * * * cd /path/to/pos-system && ./backup.sh" | crontab -
```

### Manual Backup
```bash
# Database
docker exec pos-postgres pg_dump -U pos_admin pos_system > backup.sql

# Compressed
docker exec pos-postgres pg_dump -U pos_admin pos_system | gzip > backup.sql.gz
```

### Restore
```bash
# From SQL file
cat backup.sql | docker exec -i pos-postgres psql -U pos_admin -d pos_system

# From compressed file
gunzip < backup.sql.gz | docker exec -i pos-postgres psql -U pos_admin -d pos_system
```

---

## 🔄 Updates & Maintenance

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Run migrations (if any)
docker exec -i pos-postgres psql -U pos_admin -d pos_system < database/migrations/latest.sql
```

### Update Docker Images
```bash
# Pull latest images
docker-compose pull

# Restart services
docker-compose down
docker-compose up -d
```

### Clean Up
```bash
# Remove stopped containers
docker-compose down

# Remove unused images
docker image prune -a

# Remove unused volumes (⚠️ This deletes data!)
docker volume prune
```

---

## 🐛 Troubleshooting

### Services Won't Start
```bash
# Check logs
docker-compose logs

# Check specific service
docker-compose logs backend

# Restart service
docker-compose restart backend

# Rebuild service
docker-compose up -d --build backend
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker exec -it pos-postgres psql -U pos_admin -d pos_system

# Verify credentials in .env
cat .env | grep DB_
```

### Backend API Not Responding
```bash
# Check backend logs
docker-compose logs backend

# Check environment variables
docker exec pos-backend env | grep DB_

# Restart backend
docker-compose restart backend

# Test health endpoint
curl http://localhost:3001/health
```

### Frontend Can't Connect to Backend
```bash
# Check VITE_API_URL in .env
cat .env | grep VITE_API_URL

# Should be: http://localhost:3001

# Rebuild frontend
docker-compose up -d --build frontend
```

### Out of Disk Space
```bash
# Check disk usage
df -h
docker system df

# Clean up
docker system prune -a
docker volume prune

# Check logs size
du -sh /var/lib/docker/containers/*/*-json.log
```

### Port Already in Use
```bash
# Find process using port
sudo lsof -i :3000
sudo lsof -i :3001

# Kill process
sudo kill -9 <PID>

# Or change port in docker-compose.yml
```

---

## ✅ Post-Deployment Checklist

- [ ] All services are running (`docker-compose ps`)
- [ ] Database is initialized (`\dt` shows tables)
- [ ] Can access frontend (http://localhost:3000)
- [ ] Can access backend API (http://localhost:3001/health)
- [ ] Can sign up and login
- [ ] Can create products
- [ ] Can make transactions
- [ ] Backups are configured
- [ ] Firewall is configured
- [ ] SSL is configured (production)
- [ ] Monitoring is setup
- [ ] Passwords are changed from defaults

---

## 📞 Support

### Common Issues
1. **Services won't start:** Check logs with `docker-compose logs`
2. **Can't connect to database:** Verify credentials in `.env`
3. **Backend errors:** Check `docker-compose logs backend`
4. **Frontend blank page:** Check browser console for errors

### Resources
- Full Documentation: `README.md`
- API Documentation: See "API Endpoints" section
- Database Schema: `database_setup.sql`
- Deployment Issues: `IMPLEMENTATION_ISSUES.md`

---

## 🎉 Success!

Your POS system is now running!

**URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/health
- MinIO Console: http://localhost:9001

**Default Credentials (MinIO):**
- Username: minioadmin
- Password: (from .env MINIO_SECRET_KEY)

**Next Steps:**
1. Create your admin account
2. Add products
3. Configure categories
4. Start selling!

---

**Deployment Time:** ~15 minutes
**Status:** ✅ Production Ready
**Version:** 1.0.0
