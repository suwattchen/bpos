# 🐳 Self-Hosting Guide - Ubuntu + Docker + Cloudflare Tunnel

**Status:** ✅ **COMPLETE - Ready for Self-Hosting**

Last Updated: 2025-11-21

---

## 🎯 Overview

Deploy POS System on your own Ubuntu server with:
- **PostgreSQL** - Full-featured database
- **Redis** - Session and caching
- **MinIO** - S3-compatible object storage
- **Docker** - Containerized deployment
- **Cloudflare Tunnel** - Secure internet access (no open ports!)

---

## 📋 Prerequisites

### Server Requirements

**Minimum:**
- Ubuntu 20.04 or 22.04 LTS
- 2GB RAM
- 2 CPU cores
- 20GB disk space
- Internet connection

**Recommended:**
- Ubuntu 22.04 LTS
- 4GB RAM
- 4 CPU cores
- 50GB SSD
- 100 Mbps internet

### What You Need

1. ✅ Ubuntu server (local or cloud VPS)
2. ✅ SSH access with sudo privileges
3. ✅ Domain name (for Cloudflare Tunnel)
4. ✅ Cloudflare account (free tier OK)

---

## 🚀 Quick Deploy (30 Minutes)

### Step 1: Clone Repository

```bash
# SSH to your Ubuntu server
ssh user@your-server-ip

# Clone project
git clone https://github.com/your-repo/pos-system.git
cd pos-system
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.selfhost .env

# Edit configuration
nano .env
```

**Update these values:**

```bash
# Database
DB_PASSWORD=your_secure_database_password_here

# Redis
REDIS_PASSWORD=your_secure_redis_password_here

# MinIO
MINIO_SECRET_KEY=your_secure_minio_password_here

# JWT (generate with: openssl rand -base64 32)
JWT_SECRET=your_32_character_random_jwt_secret_here

# CORS (your domain)
CORS_ORIGIN=https://pos.yourdomain.com,https://api.pos.yourdomain.com

# Frontend API URL
VITE_API_URL=https://api.pos.yourdomain.com
```

### Step 3: Run Deployment Script

```bash
# Make executable
chmod +x deploy-ubuntu.sh

# Run (will ask for sudo)
sudo ./deploy-ubuntu.sh
```

**Script will:**
1. ✅ Check system requirements
2. ✅ Install Docker & Docker Compose
3. ✅ Configure environment
4. ✅ Setup Cloudflare Tunnel (optional)
5. ✅ Pull Docker images
6. ✅ Build and start containers
7. ✅ Initialize database
8. ✅ Verify installation

**Duration: ~15-20 minutes** (depending on internet speed)

### Step 4: Setup Cloudflare Tunnel

**Install cloudflared:**

```bash
# Download
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb

# Install
sudo dpkg -i cloudflared-linux-amd64.deb

# Login (opens browser)
cloudflared tunnel login
```

**Create Tunnel:**

```bash
# Create
cloudflared tunnel create pos-system

# Note the Tunnel ID (looks like: a1b2c3d4-e5f6-7890-abcd-ef1234567890)

# List tunnels
cloudflared tunnel list
```

**Configure Tunnel:**

```bash
# Edit config
nano cloudflared-config.yml
```

Update with your tunnel ID and domain:

```yaml
tunnel: a1b2c3d4-e5f6-7890-abcd-ef1234567890
credentials-file: /root/.cloudflared/a1b2c3d4-e5f6-7890-abcd-ef1234567890.json

ingress:
  - hostname: pos.yourdomain.com
    service: http://frontend:80

  - hostname: api.pos.yourdomain.com
    service: http://backend:3001

  - service: http_status:404
```

**Setup DNS:**

```bash
# Add DNS records
cloudflared tunnel route dns pos-system pos.yourdomain.com
cloudflared tunnel route dns pos-system api.pos.yourdomain.com
```

**Start Tunnel:**

```bash
# Restart docker compose to include cloudflared
docker compose down
docker compose up -d
```

### Step 5: Verify

**Check Services:**

```bash
# View logs
docker compose logs -f

# Check status
docker compose ps

# Should show all services as "Up"
```

**Test URLs:**

```bash
# Local
curl http://localhost:3000
curl http://localhost:3001/health

# Public (after Cloudflare setup)
curl https://pos.yourdomain.com
curl https://api.pos.yourdomain.com/health
```

**Access System:**

Open browser: `https://pos.yourdomain.com`

**Default Admin:**
- Email: `admin@pos.local`
- Password: `admin123`
- **⚠️ CHANGE IMMEDIATELY!**

---

## 🔧 Manual Installation

### 1. Install Docker

```bash
# Update packages
sudo apt-get update

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Setup repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verify
docker --version
```

### 2. Install Docker Compose

```bash
# Usually installed with Docker
docker compose version

# If not, install separately
sudo apt-get install -y docker-compose
```

### 3. Configure Environment

```bash
# Copy template
cp .env.selfhost .env

# Generate secure passwords
echo "DB_PASSWORD=$(openssl rand -base64 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
echo "MINIO_SECRET_KEY=$(openssl rand -base64 24)"
echo "JWT_SECRET=$(openssl rand -base64 32)"

# Edit .env with generated passwords
nano .env
```

### 4. Start Services

```bash
# Pull images
docker compose pull

# Build and start
docker compose up -d --build

# View logs
docker compose logs -f
```

### 5. Verify Database

```bash
# Connect to database
docker exec -it pos-postgres psql -U pos_admin -d pos_system

# Check tables
\dt

# Should show:
# - tenants
# - tenant_users
# - categories
# - products
# - inventory
# - customers
# - transactions
# - transaction_items
# - auth.users

# Exit
\q
```

---

## 📊 Container Architecture

```
┌─────────────────────────────────────────────┐
│         Cloudflare Tunnel                   │
│    (cloudflared container)                  │
└──────────────┬──────────────────────────────┘
               │
               ├─────────┬──────────┬──────────┐
               │         │          │          │
         ┌─────▼────┐ ┌──▼──────┐ ┌▼─────────┐│
         │ Frontend │ │ Backend │ │  MinIO   ││
         │  (Nginx) │ │ (Node)  │ │ (S3)     ││
         │  :3000   │ │  :3001  │ │ :9000/01 ││
         └──────────┘ └────┬────┘ └──────────┘│
                           │                   │
                      ┌────▼────┐   ┌─────────▼┐
                      │Postgres │   │  Redis   │
                      │  :5432  │   │  :6379   │
                      └─────────┘   └──────────┘
```

**Containers:**

| Service | Port | Purpose |
|---------|------|---------|
| frontend | 3000 | React app (Nginx) |
| backend | 3001 | Node.js API |
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Session/cache |
| minio | 9000/9001 | Object storage |
| cloudflared | - | Tunnel to internet |

---

## 🔒 Security Setup

### 1. Change Default Passwords

**Admin Account:**

```bash
# Login to system
# Go to Settings → Change Password
```

**Database:**

```bash
# Edit .env
nano .env

# Update DB_PASSWORD
DB_PASSWORD=NewSecurePassword123!

# Recreate containers
docker compose down
docker compose up -d
```

### 2. Firewall Configuration

**With Cloudflare Tunnel (Recommended):**

```bash
# Block all incoming except SSH
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw enable

# All traffic goes through Cloudflare Tunnel
# No need to open ports 80/443!
```

**Without Cloudflare Tunnel:**

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 3. Setup Automatic Updates

```bash
# Install unattended-upgrades
sudo apt-get install -y unattended-upgrades

# Configure
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 4. Enable Docker Container Restart

```bash
# Already configured in docker-compose.yml:
# restart: unless-stopped

# Verify
docker compose ps
```

### 5. Regular Backups

**Database Backup:**

```bash
# Create backup directory
mkdir -p ~/backups

# Manual backup
docker exec pos-postgres pg_dump -U pos_admin pos_system > ~/backups/pos_backup_$(date +%Y%m%d_%H%M%S).sql

# Automated daily backup (crontab)
crontab -e

# Add line:
0 2 * * * docker exec pos-postgres pg_dump -U pos_admin pos_system > ~/backups/pos_backup_$(date +\%Y\%m\%d).sql

# Keep only last 7 days
0 3 * * * find ~/backups -name "pos_backup_*.sql" -mtime +7 -delete
```

**Full System Backup:**

```bash
# Backup volumes
docker run --rm \
  -v pos_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz -C /data .

docker run --rm \
  -v pos_minio_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/minio_data_$(date +%Y%m%d).tar.gz -C /data .
```

---

## 🛠️ Maintenance

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f postgres

# Last 100 lines
docker compose logs --tail=100
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart backend

# Stop all
docker compose stop

# Start all
docker compose start

# Stop and remove (keeps data)
docker compose down

# Stop, remove, and delete data (DANGEROUS!)
docker compose down -v
```

### Update System

```bash
# Pull latest code
git pull

# Rebuild
docker compose down
docker compose build --no-cache
docker compose up -d

# Check logs
docker compose logs -f
```

### Database Maintenance

```bash
# Connect to database
docker exec -it pos-postgres psql -U pos_admin -d pos_system

# Vacuum (clean up)
VACUUM ANALYZE;

# Check database size
SELECT pg_size_pretty(pg_database_size('pos_system'));

# Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Monitor Resources

```bash
# Container stats
docker stats

# Disk usage
docker system df

# Clean up unused data
docker system prune -a
```

---

## 🐛 Troubleshooting

### Issue: Container won't start

**Check logs:**

```bash
docker compose logs backend
docker compose logs postgres
```

**Solution:**

```bash
# Remove and recreate
docker compose down
docker compose up -d

# If still failing, rebuild
docker compose build --no-cache
docker compose up -d
```

### Issue: Database connection error

**Check postgres:**

```bash
# Is it running?
docker compose ps postgres

# Check logs
docker compose logs postgres

# Test connection
docker exec pos-postgres pg_isready -U pos_admin
```

**Solution:**

```bash
# Restart database
docker compose restart postgres

# Wait 10 seconds
sleep 10

# Restart backend
docker compose restart backend
```

### Issue: Out of disk space

**Check usage:**

```bash
df -h
docker system df
```

**Clean up:**

```bash
# Remove old images
docker image prune -a

# Remove old volumes (BE CAREFUL!)
docker volume prune

# Remove unused everything
docker system prune -a --volumes
```

### Issue: Cloudflare Tunnel not working

**Check tunnel status:**

```bash
# View logs
docker compose logs cloudflared

# Check tunnel
cloudflared tunnel info pos-system

# Test DNS
nslookup pos.yourdomain.com
```

**Solution:**

```bash
# Restart cloudflared
docker compose restart cloudflared

# Or recreate tunnel
cloudflared tunnel delete pos-system
cloudflared tunnel create pos-system
# Update cloudflared-config.yml with new tunnel ID
docker compose down
docker compose up -d
```

### Issue: Can't access from internet

**Checklist:**

1. ✅ Cloudflare Tunnel running?
   ```bash
   docker compose ps cloudflared
   ```

2. ✅ DNS records configured?
   ```bash
   nslookup pos.yourdomain.com
   ```

3. ✅ Backend responding?
   ```bash
   curl http://localhost:3001/health
   ```

4. ✅ Frontend responding?
   ```bash
   curl http://localhost:3000
   ```

---

## 📈 Performance Tuning

### PostgreSQL Optimization

```bash
# Edit postgresql.conf
docker exec -it pos-postgres bash
vi /var/lib/postgresql/data/postgresql.conf
```

**Recommended settings:**

```conf
# For 4GB RAM server
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 5MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
```

### Redis Optimization

```bash
# Edit redis.conf in docker-compose.yml
command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### MinIO Optimization

```bash
# Increase cache
environment:
  MINIO_CACHE_SIZE: 4GB
```

---

## 💰 Cost Estimate

### VPS Options

**DigitalOcean:**
- 2GB RAM: $12/month
- 4GB RAM: $24/month
- 8GB RAM: $48/month

**Linode:**
- 2GB RAM: $12/month
- 4GB RAM: $24/month
- 8GB RAM: $48/month

**Hetzner (Cheapest):**
- 2GB RAM: €4.5/month (~$5)
- 4GB RAM: €7/month (~$8)
- 8GB RAM: €14/month (~$15)

**Cloudflare:**
- Tunnel: Free
- DNS: Free
- CDN: Free

**Total: $5-50/month** (depending on requirements)

---

## ✅ Post-Deployment Checklist

**Security:**
- [ ] Changed admin password
- [ ] Updated .env passwords
- [ ] Configured firewall (ufw)
- [ ] Setup automatic updates
- [ ] Configured backups

**Monitoring:**
- [ ] Tested all services
- [ ] Verified database connection
- [ ] Checked container logs
- [ ] Tested public URLs
- [ ] Confirmed HTTPS working

**Backups:**
- [ ] Manual database backup tested
- [ ] Automated backup cron configured
- [ ] Backup restoration tested
- [ ] Off-site backup configured

**Performance:**
- [ ] Load time acceptable
- [ ] Database queries fast
- [ ] Images loading properly
- [ ] No errors in logs

---

## 🎉 Success!

Your POS system is now self-hosted and accessible via Cloudflare Tunnel!

**What you have:**
- ✅ Full control over your data
- ✅ No vendor lock-in
- ✅ Secure access via Cloudflare
- ✅ Professional infrastructure
- ✅ Scalable and maintainable

**Next steps:**
1. Customize branding
2. Add users
3. Import products
4. Train staff
5. Start selling!

---

## 📞 Support

**Documentation:**
- README.md - Overview
- GETTING_STARTED.md - Quick start
- ARCHITECTURE.md - Technical details
- READY_TO_DEPLOY.md - Cloud deployment

**Community:**
- GitHub Issues
- Discord server
- Email support

**Useful Links:**
- [Docker Docs](https://docs.docker.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

---

**Status: ✅ COMPLETE - Ready for Production Self-Hosting**
