# 🚀 Self-Host Quick Start - Ubuntu + Docker + Cloudflare

**เวลาโดยประมาณ: 30 นาที**

---

## ✅ สิ่งที่ต้องมี

- [ ] Ubuntu Server 20.04/22.04 (VPS หรือ Local Server)
- [ ] RAM 2GB ขึ้นไป
- [ ] Disk 20GB ขึ้นไป
- [ ] Domain name (เช่น yourdomain.com)
- [ ] Cloudflare account (ฟรี)

---

## 🎯 ขั้นตอนการติดตั้ง

### 1. เตรียม Server (5 นาที)

```bash
# SSH เข้า server
ssh user@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Clone project
git clone https://github.com/your-repo/pos-system.git
cd pos-system
```

### 2. แก้ไข Config (3 นาที)

```bash
# Copy template
cp .env.selfhost .env

# Generate passwords
echo "DB_PASSWORD=$(openssl rand -base64 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
echo "MINIO_SECRET_KEY=$(openssl rand -base64 24)"
echo "JWT_SECRET=$(openssl rand -base64 32)"

# แก้ไข .env (ใส่ passwords ที่ generate ด้านบน)
nano .env
```

**แก้ไขบรรทัดเหล่านี้:**
```bash
DB_PASSWORD=your_generated_password_here
REDIS_PASSWORD=your_generated_password_here
MINIO_SECRET_KEY=your_generated_password_here
JWT_SECRET=your_generated_jwt_secret_here
CORS_ORIGIN=https://pos.yourdomain.com
VITE_API_URL=https://api.pos.yourdomain.com
```

### 3. ติดตั้งและรันระบบ (15 นาที)

```bash
# รัน script อัตโนมัติ
chmod +x deploy-ubuntu.sh
sudo ./deploy-ubuntu.sh
```

**Script จะทำให้:**
- ติดตั้ง Docker
- สร้าง containers ทั้งหมด
- Initialize database
- เริ่มระบบ

### 4. ตั้งค่า Cloudflare Tunnel (7 นาที)

**ติดตั้ง cloudflared:**
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

**Login และสร้าง tunnel:**
```bash
# Login (เปิด browser)
cloudflared tunnel login

# สร้าง tunnel
cloudflared tunnel create pos-system

# จด Tunnel ID ที่ได้ (เช่น: a1b2c3d4-e5f6-7890-abcd-ef1234567890)
```

**แก้ไข config:**
```bash
nano cloudflared-config.yml
```

เปลี่ยน `YOUR_TUNNEL_ID_HERE` เป็น Tunnel ID ที่คุณได้:
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

**ตั้งค่า DNS:**
```bash
cloudflared tunnel route dns pos-system pos.yourdomain.com
cloudflared tunnel route dns pos-system api.pos.yourdomain.com
```

**Restart containers:**
```bash
docker compose down
docker compose up -d
```

### 5. ทดสอบระบบ

**ตรวจสอบ containers:**
```bash
docker compose ps
# ควรเห็น all services เป็น "Up"
```

**เข้าใช้งาน:**
- เปิด browser: `https://pos.yourdomain.com`
- Login:
  - Email: `admin@pos.local`
  - Password: `admin123`
- **⚠️ เปลี่ยนรหัสผ่านทันที!**

---

## 🔒 Security (ทำทันที!)

### 1. เปลี่ยนรหัสผ่าน Admin

Login → Settings → Change Password

### 2. ตั้งค่า Firewall

```bash
sudo ufw allow 22/tcp     # SSH only
sudo ufw enable
```

ไม่ต้องเปิด port 80/443 เพราะใช้ Cloudflare Tunnel!

### 3. ตั้งค่า Backup อัตโนมัติ

```bash
# เปิด crontab
crontab -e

# เพิ่มบรรทัดนี้ (backup ทุกวันเวลา 2 AM)
0 2 * * * docker exec pos-postgres pg_dump -U pos_admin pos_system > ~/backup_$(date +\%Y\%m\%d).sql
```

---

## 📊 คำสั่งที่ใช้บ่อย

```bash
# ดู logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose stop

# Start
docker compose start

# Backup database
docker exec pos-postgres pg_dump -U pos_admin pos_system > backup.sql

# Restore database
docker exec -i pos-postgres psql -U pos_admin pos_system < backup.sql

# ดูสถานะ
docker stats

# Update system
git pull
docker compose down
docker compose up -d --build
```

---

## 🐛 แก้ปัญหาเบื้องต้น

### ปัญหา: Container ไม่ start

```bash
docker compose logs [service_name]
docker compose restart [service_name]
```

### ปัญหา: Database connection error

```bash
docker compose restart postgres
sleep 10
docker compose restart backend
```

### ปัญหา: ไม่สามารถเข้าผ่าน domain

1. ตรวจ DNS: `nslookup pos.yourdomain.com`
2. ตรวจ tunnel: `docker compose logs cloudflared`
3. ตรวจ local: `curl http://localhost:3000`

---

## 📈 Specs แนะนำตาม User

| Users/Day | RAM | CPU | Disk | VPS Cost |
|-----------|-----|-----|------|----------|
| 1-10 | 2GB | 2 | 20GB | $5/mo |
| 10-50 | 4GB | 2 | 50GB | $12/mo |
| 50-200 | 8GB | 4 | 100GB | $24/mo |
| 200+ | 16GB | 8 | 200GB | $48/mo |

---

## ✅ Checklist หลัง Deploy

- [ ] เข้าระบบได้
- [ ] เปลี่ยนรหัสผ่าน admin
- [ ] เพิ่มสินค้าทดสอบ
- [ ] ทำการขายทดสอบ
- [ ] Setup backup
- [ ] Setup monitoring
- [ ] ปิด firewall (เปิดแค่ SSH)
- [ ] ทดสอบ HTTPS

---

## 🎉 เสร็จแล้ว!

ระบบ POS ของคุณพร้อมใช้งานแล้ว!

**ข้อดี:**
- ✅ ข้อมูลอยู่ใน server ของคุณเอง
- ✅ ไม่มีค่าใช้จ่ายรายเดือนเพิ่ม
- ✅ ปลอดภัยด้วย Cloudflare
- ✅ ไม่ต้องเปิด port ที่เสี่ยง
- ✅ Scalable ตามต้องการ

**เอกสารเพิ่มเติม:**
- SELF_HOST_GUIDE.md - คู่มือละเอียด
- READY_TO_DEPLOY.md - Deploy บน Cloud
- ARCHITECTURE.md - สถาปัตยกรรมระบบ

---

**สนับสนุน:** GitHub Issues | Discord | Email
