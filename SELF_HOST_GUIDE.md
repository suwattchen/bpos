# 🏠 Self-Hosting Guide - POS System

Comprehensive guide for deploying and maintaining a self-hosted POS system in production.

## 📖 Table of Contents

- [Overview](#overview)
- [Hardware Requirements](#hardware-requirements)
- [Installation](#installation)
- [Security Hardening](#security-hardening)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Backup & Recovery](#backup--recovery)
- [Monitoring](#monitoring)
- [Maintenance](#maintenance)
- [Scaling](#scaling)

---

## 🎯 Overview

This system is **100% self-hosted** with no external dependencies:

```
Frontend (React) → Backend API (Node.js) → PostgreSQL Database
                 ↓
           MinIO (Storage) + Redis (Cache)
```

**Key Benefits:**
- Complete data ownership
- No subscription fees
- Full control over infrastructure
- Privacy compliant (GDPR, HIPAA ready)
- Offline capability

---

## 💻 Hardware Requirements

### Minimum (Testing/Development)
- **CPU:** 2 cores
- **RAM:** 2GB
- **Disk:** 20GB SSD
- **Network:** 10 Mbps

### Recommended (Production <100 users)
- **CPU:** 4 cores
- **RAM:** 8GB
- **Disk:** 100GB SSD (RAID 1 recommended)
- **Network:** 100 Mbps

### Enterprise (Production >100 users)
- **CPU:** 8+ cores
- **RAM:** 16GB+
- **Disk:** 500GB+ SSD with RAID 10
- **Network:** 1 Gbps
- **Redundancy:** Load balancer + Multiple instances

---

## 🚀 Installation

### Step 1: Prepare Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify
docker --version
docker compose version
```

### Step 2: Clone & Configure

```bash
# Clone repository
git clone https://github.com/yourusername/pos-system.git
cd pos-system

# Setup environment
cp .env.example .env

# Generate secure secrets
export DB_PASS=$(openssl rand -base64 32)
export REDIS_PASS=$(openssl rand -base64 32)
export MINIO_PASS=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 48)

# Update .env automatically
sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASS/" .env
sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASS/" .env
sed -i "s/MINIO_SECRET_KEY=.*/MINIO_SECRET_KEY=$MINIO_PASS/" .env
sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env

# Update API URL for production
sed -i "s|VITE_API_URL=.*|VITE_API_URL=https://api.yourdomain.com|" .env
```

### Step 3: Deploy

```bash
# Start services
docker compose up -d

# Wait for services
sleep 60

# Initialize database
docker exec -i pos-postgres psql -U pos_admin -d pos_system < database/init/01-init.sql

# Verify
docker compose ps
./scripts/test-deployment.sh
```

---

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# Install UFW (Ubuntu)
sudo apt install ufw

# Allow SSH (adjust port if changed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow NPM admin (restrict to your IP)
sudo ufw allow from YOUR_IP_ADDRESS to any port 81

# Enable firewall
sudo ufw enable
sudo ufw status
```

### 2. Fail2Ban Setup

```bash
# Install fail2ban
sudo apt install fail2ban

# Configure
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5
```

```bash
# Restart
sudo systemctl restart fail2ban
sudo fail2ban-client status
```

### 3. Secure Docker

```bash
# Limit container resources
# Edit docker-compose.yml:
```

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          memory: 512M
```

### 4. Database Security

```bash
# Backup pg_hba.conf
docker exec pos-postgres cat /var/lib/postgresql/data/pg_hba.conf > pg_hba.backup

# Restrict connections (only from Docker network)
# Already configured in Docker setup
```

### 5. Change Default Ports (Optional)

Edit `docker-compose.yml`:
```yaml
services:
  npm:
    ports:
      - "8080:80"    # Change from 80
      - "8443:443"   # Change from 443
      - "8081:81"    # Change from 81
```

---

## 🔐 SSL/TLS Configuration

### Using Nginx Proxy Manager (Recommended)

1. **Access NPM Admin:**
   ```
   http://your-server:81
   Default: admin@example.com / changeme
   ```

2. **Change Admin Password:**
   - Users → Edit → Change Password
   - Use strong password (20+ characters)

3. **Add SSL Certificate:**
   - SSL Certificates → Add SSL Certificate
   - Choose: Let's Encrypt
   - Domain: yourdomain.com
   - Email: your@email.com
   - Agree to Terms
   - Save

4. **Add Proxy Host:**
   - Proxy Hosts → Add Proxy Host
   - Domain: yourdomain.com
   - Forward to: frontend:80
   - Cache Assets: ON
   - Block Common Exploits: ON
   - WebSocket Support: ON
   - SSL: Select your certificate
   - Force SSL: ON
   - HTTP/2 Support: ON
   - HSTS Enabled: ON

5. **Add API Proxy:**
   - Domain: api.yourdomain.com
   - Forward to: backend:3001
   - Same SSL settings

### Manual SSL (Alternative)

```bash
# Install Certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com

# Certificates will be in:
# /etc/letsencrypt/live/yourdomain.com/

# Mount in docker-compose.yml:
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
```

---

## 💾 Backup & Recovery

### Automated Backup Script

Create `/opt/pos-backup/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/opt/pos-backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker exec pos-postgres pg_dump -U pos_admin pos_system | \
  gzip > $BACKUP_DIR/database_$DATE.sql.gz

# Backup MinIO data
docker exec pos-minio tar czf - /data | \
  cat > $BACKUP_DIR/minio_$DATE.tar.gz

# Backup configuration
tar czf $BACKUP_DIR/config_$DATE.tar.gz .env docker-compose.yml

# Remove old backups
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete

# Log
echo "[$DATE] Backup completed" >> $BACKUP_DIR/backup.log
```

```bash
# Make executable
chmod +x /opt/pos-backup/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
```

Add:
```
0 2 * * * /opt/pos-backup/backup.sh
```

### Restore from Backup

```bash
# Stop services
docker compose down

# Restore database
gunzip < /opt/pos-backups/database_20250101_020000.sql.gz | \
  docker exec -i pos-postgres psql -U pos_admin -d pos_system

# Restore MinIO
docker exec -i pos-minio tar xzf - -C / < /opt/pos-backups/minio_20250101_020000.tar.gz

# Restore config
tar xzf /opt/pos-backups/config_20250101_020000.tar.gz

# Restart
docker compose up -d
```

### Off-site Backup (Recommended)

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure (e.g., for AWS S3)
rclone config

# Sync backups
rclone sync /opt/pos-backups remote:pos-backups --progress
```

Add to backup script:
```bash
# At end of backup.sh
rclone sync $BACKUP_DIR remote:pos-backups --progress
```

---

## 📊 Monitoring

### Setup Prometheus & Grafana (Optional)

Add to `docker-compose.yml`:

```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
    ports:
      - "9090:9090"
    networks:
      - pos-network

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - pos-network

volumes:
  prometheus_data:
  grafana_data:
```

### Basic Monitoring Script

Create `/opt/pos-monitoring/monitor.sh`:

```bash
#!/bin/bash
LOG_FILE="/var/log/pos-monitor.log"

# Check services
if ! docker compose ps | grep -q "Up"; then
  echo "$(date): Service down!" >> $LOG_FILE
  # Send alert (email, Slack, etc.)
fi

# Check disk space
DISK_USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
  echo "$(date): Disk usage high: $DISK_USAGE%" >> $LOG_FILE
fi

# Check database size
DB_SIZE=$(docker exec pos-postgres psql -U pos_admin -d pos_system -t -c "SELECT pg_database_size('pos_system');" | tr -d ' ')
if [ $DB_SIZE -gt 10000000000 ]; then  # 10GB
  echo "$(date): Database size large: $DB_SIZE bytes" >> $LOG_FILE
fi
```

```bash
chmod +x /opt/pos-monitoring/monitor.sh

# Run every 5 minutes
crontab -e
```
Add:
```
*/5 * * * * /opt/pos-monitoring/monitor.sh
```

---

## 🔧 Maintenance

### Regular Tasks

**Daily:**
- Monitor logs: `docker compose logs --tail=100`
- Check disk space: `df -h`
- Verify backups completed

**Weekly:**
- Review error logs
- Update system packages: `sudo apt update && sudo apt upgrade`
- Vacuum database: `docker exec pos-postgres psql -U pos_admin -d pos_system -c "VACUUM ANALYZE;"`

**Monthly:**
- Update Docker images
- Review and rotate logs
- Test backup restoration
- Security audit

### Update System

```bash
# Backup first!
./opt/pos-backup/backup.sh

# Pull latest changes
git pull origin main

# Rebuild images
docker compose build --no-cache

# Apply database migrations (if any)
docker exec -i pos-postgres psql -U pos_admin -d pos_system < database/migrations/latest.sql

# Restart services
docker compose up -d

# Verify
./scripts/test-deployment.sh
```

### Log Management

```bash
# View logs
docker compose logs -f

# Limit log size in docker-compose.yml:
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 📈 Scaling

### Vertical Scaling (Single Server)

```bash
# Increase resources in docker-compose.yml:
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 4G

  postgres:
    deploy:
      resources:
        limits:
          memory: 4G
```

### Horizontal Scaling (Multiple Servers)

For high traffic, consider:

1. **Load Balancer:** HAProxy or Nginx
2. **Multiple Backend Instances:** Scale backend containers
3. **Database Replication:** PostgreSQL primary/replica
4. **Redis Cluster:** For distributed caching
5. **Separate Storage:** External MinIO or S3

Architecture:
```
            Load Balancer
           /      |      \
    Backend1  Backend2  Backend3
           \      |      /
         PostgreSQL Primary
              |
         Replica (Read-only)
```

---

## 📚 Additional Resources

- [GETTING_STARTED.md](./GETTING_STARTED.md) - Initial setup
- [README.md](./README.md) - Overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture

---

**Status:** ✅ Production-Ready Self-Hosting Guide
