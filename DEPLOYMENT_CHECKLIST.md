# Deployment Checklist

## Pre-Deployment Fixes Applied ✅

### 1. API Base URL Configuration
- ✅ Set `VITE_API_URL=/api` in `.env` for proxy routing
- ✅ Updated `Dockerfile` to use `/api` as default build arg
- ✅ Frontend endpoints use relative paths (no duplication)
- ✅ Nginx proxy configured to rewrite `/api/*` → backend

**Flow**: Browser → `/api/auth/login` → Nginx → Backend at `http://backend:3001/auth/login`

### 2. Upload Endpoint Alignment
- ✅ Frontend: `api.upload.image()` → `POST /api/upload/product-image`
- ✅ Backend: Route at `POST /upload/product-image`
- ✅ Form field: `formData.append('image', file)` (matches backend)

### 3. Route Ordering Fixed
- ✅ `backend/src/routes/inventory.ts`: `/alerts/low-stock` before `/:productId`
- ✅ `backend/src/routes/transactions.ts`: `/reports/sales` before `/:id`

### 4. Environment Variables
- ✅ Removed all Supabase variables from `.env`
- ✅ Set `CORS_ORIGIN=*` for Docker (change to domain for production)
- ✅ Updated security placeholders with clear instructions to change

## Deployment Steps

### 1. Update Security Credentials
```bash
# Edit .env and change these values:
DB_PASSWORD=your_secure_password_here
REDIS_PASSWORD=your_secure_redis_password
JWT_SECRET=your_secure_jwt_secret_min_32_chars_long_change_this
MINIO_SECRET_KEY=your_secure_minio_password_change_this
```

### 2. Build and Start Containers
```bash
docker compose build
docker compose up -d
```

### 3. Verify Services Health
```bash
# Check all containers are running
docker compose ps

# Check backend health
curl http://localhost/health

# Check logs
docker compose logs -f backend
docker compose logs -f frontend
```

### 4. Test Authentication Flow
```bash
# Signup
curl -X POST http://localhost/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","name":"Test User"}'

# Login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Save the token from response
TOKEN="your_token_here"

# Test /me endpoint
curl http://localhost/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Test Product Operations
```bash
# List products
curl http://localhost/api/products \
  -H "Authorization: Bearer $TOKEN"

# Create product
curl -X POST http://localhost/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "sku": "TEST-001",
    "cost_price": 100,
    "selling_price": 150,
    "category_id": null
  }'
```

### 6. Test Image Upload
```bash
# Upload product image
curl -X POST http://localhost/api/upload/product-image \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@path/to/image.jpg"
```

### 7. Configure Nginx Proxy Manager (Optional)
1. Access NPM at `http://localhost:81`
2. Default credentials: `admin@example.com` / `changeme`
3. Add proxy host:
   - Domain: `your-domain.com`
   - Scheme: `http`
   - Forward Hostname: `frontend`
   - Forward Port: `80`
4. Enable SSL with Let's Encrypt

## Verification Checklist

- [ ] All containers running: `docker compose ps`
- [ ] Backend health check: `curl http://localhost/health`
- [ ] Signup endpoint works: `POST /api/auth/signup`
- [ ] Login endpoint works: `POST /api/auth/login`
- [ ] Protected routes require JWT: `GET /api/products`
- [ ] Product CRUD operations work
- [ ] Image upload works: `POST /api/upload/product-image`
- [ ] Frontend loads in browser: `http://localhost`
- [ ] Frontend can login through UI
- [ ] Frontend can view/create products
- [ ] Inventory updates reflect in database

## Troubleshooting

### Issue: "Cannot connect to backend"
- Check backend logs: `docker compose logs backend`
- Verify nginx proxy: `docker compose logs npm`
- Test direct backend: `docker exec pos-backend curl http://localhost:3001/health`

### Issue: "CORS error"
- Check `CORS_ORIGIN` in `.env` matches frontend origin
- Restart backend: `docker compose restart backend`

### Issue: "JWT authentication failed"
- Verify `JWT_SECRET` is set and consistent
- Check token in localStorage (browser DevTools)
- Test `/api/auth/me` endpoint

### Issue: "Upload fails"
- Check MinIO is running: `docker compose ps minio`
- Verify bucket creation in MinIO logs
- Test MinIO connection from backend

### Issue: "Database connection failed"
- Check postgres logs: `docker compose logs postgres`
- Verify credentials in `.env` match compose
- Check database initialization: `docker compose exec postgres psql -U pos_admin -d pos_system -c "\dt"`

## Production Considerations

1. **Security**:
   - Change all default passwords in `.env`
   - Set `CORS_ORIGIN` to actual frontend domain
   - Use strong JWT_SECRET (min 32 characters)
   - Enable SSL/TLS through NPM or direct nginx

2. **Performance**:
   - Set up database backups
   - Configure Redis persistence
   - Monitor container resources
   - Set up log rotation

3. **Monitoring**:
   - Set up health check monitoring
   - Configure alerts for service failures
   - Monitor disk usage for volumes
   - Track API response times

4. **Backup Strategy**:
   ```bash
   # Backup database
   docker compose exec postgres pg_dump -U pos_admin pos_system > backup.sql

   # Backup MinIO data
   docker compose exec minio mc mirror /data /backup
   ```

## Architecture Diagram

```
Browser
   ↓
Nginx Proxy Manager (:80/:443)
   ↓
   ├─→ /api/* → Backend API (:3001)
   │            ↓
   │            ├─→ PostgreSQL (:5432)
   │            ├─→ Redis (:6379)
   │            └─→ MinIO (:9000)
   │
   └─→ /* → Frontend SPA (:80)
```

## Next Steps

1. Test complete user flow through UI
2. Verify all features work (POS, inventory, reports)
3. Set up automated backups
4. Configure domain and SSL
5. Set up monitoring and alerting
6. Load test with expected traffic
7. Create admin user for production
