# Getting Started - Multi-Tenant POS System

## ขั้นตอนการติดตั้งและเริ่มใช้งาน

### ✅ สิ่งที่ทำเสร็จแล้ว
- Frontend application (React + TypeScript + Tailwind CSS)
- Authentication system (Supabase Auth)
- Product management with image upload
- POS interface
- Offline support (PWA)
- Database schema design

### ⚠️ สิ่งที่ต้องทำก่อนใช้งาน (CRITICAL)

## 1. Setup Database Tables

**ไปที่:** https://supabase.com/dashboard/project/_/sql

**คัดลอกและรัน SQL จาก:** `database_setup.sql`

ไฟล์นี้จะสร้าง:
- ✅ ตารางทั้งหมด (tenants, products, transactions, etc.)
- ✅ RLS policies สำหรับความปลอดภัย
- ✅ Helper functions
- ✅ Storage bucket สำหรับรูปภาพ
- ✅ Auto-create tenant เมื่อมี user ใหม่

**หลังจากรัน SQL แล้ว ระบบจะพร้อมใช้งานทันที!**

---

## 2. Test the Application

### 2.1 Sign Up
```
1. เปิด http://localhost:5173
2. กรอก Email และ Password
3. Click "Sign Up"
4. ระบบจะสร้าง Tenant อัตโนมัติ
```

### 2.2 Add Products
```
1. ไปที่เมนู "Products"
2. Click "Add Product"
3. กรอกข้อมูล:
   - SKU: PROD-001
   - Name: ชาไทย
   - Price: 25.00
   - Tax: 7%
4. อัพโหลดรูปภาพ (จะ optimize อัตโนมัติ)
5. Save
```

### 2.3 Make a Sale
```
1. ไปที่เมนู "Point of Sale"
2. ค้นหาและเลือกสินค้า
3. เพิ่มเข้าตะกร้า
4. Click "Checkout"
5. เลือกวิธีชำระเงิน
6. ยืนยัน
```

---

## 3. Common Issues & Solutions

### Issue 1: "Table does not exist"
**สาเหตุ:** ยังไม่ได้รัน database_setup.sql

**แก้ไข:**
1. ไปที่ Supabase SQL Editor
2. Paste และรัน `database_setup.sql`
3. Refresh page

### Issue 2: "No data showing after login"
**สาเหตุ:** User ไม่มีข้อมูลใน tenant_users

**แก้ไข:**
- ระบบจะสร้างอัตโนมัติเมื่อ signup ใหม่
- หรือรัน SQL:
```sql
INSERT INTO tenant_users (tenant_id, user_id, role)
VALUES (
  '<TENANT_ID>',
  '<USER_ID>',
  'tenant_admin'
);
```

### Issue 3: "Cannot upload images"
**สาเหตุ:** Storage bucket ยังไม่ถูกสร้าง

**แก้ไข:** รัน SQL นี้:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT DO NOTHING;
```

### Issue 4: "Offline mode not working"
**สาเหตุ:** Service Worker ยังไม่ active

**แก้ไข:**
1. เปิด DevTools → Application → Service Workers
2. Check "Update on reload"
3. Refresh page

---

## 4. Environment Variables

ไฟล์ `.env` มี:
```
VITE_SUPABASE_URL=<YOUR_SUPABASE_URL>
VITE_SUPABASE_ANON_KEY=<YOUR_ANON_KEY>
```

**ตรวจสอบว่า:**
- ✅ URL ถูกต้อง
- ✅ Anon key ถูกต้อง
- ✅ RLS เปิดใช้งาน

---

## 5. Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run typecheck

# Lint code
npm run lint
```

---

## 6. Project Structure

```
src/
├── components/          # React components
│   ├── Dashboard.tsx    # Main layout
│   ├── POSInterface.tsx # POS screen
│   ├── ProductForm.tsx  # Add/Edit products
│   ├── ImageUpload.tsx  # Image optimization
│   └── LoginForm.tsx    # Authentication
├── contexts/
│   └── AuthContext.tsx  # Auth state management
├── lib/
│   ├── supabase.ts      # Supabase client
│   └── database.types.ts # TypeScript types
└── utils/
    ├── imageOptimization.ts # Image processing
    └── pwa.ts               # PWA utilities
```

---

## 7. Features Overview

### ✅ Implemented
- [x] Multi-tenant architecture
- [x] Email/password authentication
- [x] Product CRUD with categories
- [x] Image upload & optimization
- [x] POS interface with cart
- [x] Tax calculation
- [x] Transaction recording
- [x] Offline support (PWA)
- [x] Responsive design

### 🚧 Partially Implemented
- [ ] Inventory tracking (database ready, UI pending)
- [ ] Customer management (database ready, UI pending)
- [ ] Promotions engine (database ready, UI pending)

### 📋 Planned Features
- [ ] Barcode scanner
- [ ] Receipt printing
- [ ] Reports & analytics
- [ ] Multi-payment methods
- [ ] Customer loyalty program
- [ ] Email notifications
- [ ] Export data (CSV/PDF)

---

## 8. Database Schema Summary

### Core Tables
1. **tenants** - Store/business info
2. **tenant_users** - User-tenant relationships
3. **categories** - Product categories
4. **products** - Product catalog
5. **inventory** - Stock levels
6. **customers** - Customer database
7. **transactions** - Sales records
8. **transaction_items** - Line items
9. **promotions** - Marketing campaigns

### Security
- ✅ Row-Level Security (RLS) on all tables
- ✅ Role-based access control
- ✅ Auto-tenant creation for new users
- ✅ Secure storage policies

---

## 9. Testing Checklist

### Before Production
- [ ] Run `database_setup.sql` in production
- [ ] Test signup flow
- [ ] Test login flow
- [ ] Add test products
- [ ] Complete test transaction
- [ ] Test offline mode
- [ ] Test image upload
- [ ] Verify RLS policies
- [ ] Check mobile responsiveness
- [ ] Performance testing

### Security Audit
- [ ] Verify RLS policies work
- [ ] Test cross-tenant isolation
- [ ] Check role permissions
- [ ] Validate input sanitization
- [ ] Review error messages (no data leaks)

---

## 10. Performance Tips

### Optimize Images
- Max 800x800px
- 85% quality JPEG
- Lazy loading enabled

### Database
- Indexes on foreign keys
- Composite indexes for queries
- Use `.select('*')` sparingly

### Frontend
- Code splitting (Vite)
- Lazy load components
- Debounce search inputs

---

## 11. Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Vercel/Netlify
```bash
# Vercel
vercel deploy

# Netlify
netlify deploy --prod
```

### Environment Variables (Production)
```
VITE_SUPABASE_URL=<PRODUCTION_URL>
VITE_SUPABASE_ANON_KEY=<PRODUCTION_KEY>
```

---

## 12. Support & Resources

### Documentation
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)

### Need Help?
1. Check `IMPLEMENTATION_ISSUES.md`
2. Review `database_setup.sql`
3. Check browser console for errors
4. Verify Supabase dashboard

---

## 🎉 You're Ready!

หลังจากรัน `database_setup.sql` แล้ว คุณสามารถ:
1. Signup ผู้ใช้ใหม่
2. เพิ่มสินค้า
3. ทำรายการขาย
4. ดูข้อมูลแบบ real-time

**Happy Selling! 🚀**
