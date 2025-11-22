-- ========================================
-- Multi-Tenant POS System - Database Setup
-- ========================================
-- คัดลอก SQL นี้ไปรันใน Supabase SQL Editor
-- https://supabase.com/dashboard/project/_/sql

-- Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- STEP 1: Create Core Tables
-- ========================================

-- 1.1 TENANTS TABLE
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 1.2 TENANT USERS TABLE
CREATE TABLE IF NOT EXISTS tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('system_admin', 'tenant_admin', 'manager', 'cashier')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);

-- 1.3 CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- 1.4 PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  sku text NOT NULL,
  barcode text,
  name text NOT NULL,
  description text DEFAULT '',
  image_url text,
  cost_price decimal(10,2) DEFAULT 0,
  selling_price decimal(10,2) NOT NULL,
  tax_rate decimal(5,2) DEFAULT 7,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- 1.5 INVENTORY TABLE
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location text DEFAULT 'main',
  quantity integer DEFAULT 0,
  reorder_level integer DEFAULT 10,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(tenant_id, product_id, location)
);

CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);

-- 1.6 CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_code text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  loyalty_points integer DEFAULT 0,
  total_spent decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, customer_code)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);

-- 1.7 TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_number text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  cashier_id uuid NOT NULL REFERENCES auth.users(id),
  subtotal decimal(10,2) DEFAULT 0,
  tax_amount decimal(10,2) DEFAULT 0,
  discount_amount decimal(10,2) DEFAULT 0,
  total_amount decimal(10,2) NOT NULL,
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'qr', 'e-wallet', 'multiple')),
  payment_status text DEFAULT 'completed' CHECK (payment_status IN ('completed', 'refunded', 'cancelled')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, transaction_number)
);

CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(tenant_id, created_at DESC);

-- 1.8 TRANSACTION ITEMS TABLE
CREATE TABLE IF NOT EXISTS transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price decimal(10,2) NOT NULL,
  discount_amount decimal(10,2) DEFAULT 0,
  tax_amount decimal(10,2) DEFAULT 0,
  subtotal decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_tenant ON transaction_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON transaction_items(product_id);

-- 1.9 PROMOTIONS TABLE
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  type text NOT NULL CHECK (type IN ('percentage', 'fixed_amount', 'buy_x_get_y', 'bundle')),
  value decimal(10,2) DEFAULT 0,
  conditions jsonb DEFAULT '{}'::jsonb,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotions_tenant ON promotions(tenant_id);

-- ========================================
-- STEP 2: Helper Functions
-- ========================================

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper function for RLS (แก้ปัญหา circular dependency)
CREATE OR REPLACE FUNCTION get_user_tenant_ids()
RETURNS SETOF uuid AS $$
BEGIN
  RETURN QUERY
  SELECT tenant_id
  FROM tenant_users
  WHERE user_id = auth.uid()
  AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check role
CREATE OR REPLACE FUNCTION user_has_role(check_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM tenant_users
    WHERE user_id = auth.uid()
    AND role = check_role
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to decrease inventory
CREATE OR REPLACE FUNCTION decrease_inventory(
  p_product_id uuid,
  p_quantity integer,
  p_location text DEFAULT 'main'
)
RETURNS void AS $$
BEGIN
  UPDATE inventory
  SET quantity = quantity - p_quantity,
      last_updated = now()
  WHERE product_id = p_product_id
  AND location = p_location;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found in inventory';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create tenant for new user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_tenant_id uuid;
  user_email text;
  store_name text;
BEGIN
  user_email := NEW.email;
  store_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(user_email, '@', 1) || '''s Store');

  -- Create tenant
  INSERT INTO tenants (name, slug, settings)
  VALUES (
    store_name,
    'store-' || NEW.id,
    '{"currency": "THB", "tax_rate": 7, "timezone": "Asia/Bangkok"}'::jsonb
  )
  RETURNING id INTO new_tenant_id;

  -- Add user to tenant_users
  INSERT INTO tenant_users (tenant_id, user_id, role, is_active)
  VALUES (new_tenant_id, NEW.id, 'tenant_admin', true);

  -- Create default category
  INSERT INTO categories (tenant_id, name, description)
  VALUES (new_tenant_id, 'General', 'Default product category');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ========================================
-- STEP 3: Enable RLS on All Tables
-- ========================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 4: Create RLS Policies
-- ========================================

-- TENANTS POLICIES
DROP POLICY IF EXISTS "Users can view own tenants" ON tenants;
CREATE POLICY "Users can view own tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Tenant admins can update own tenant" ON tenants;
CREATE POLICY "Tenant admins can update own tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT get_user_tenant_ids())
    AND user_has_role('tenant_admin')
  );

-- TENANT_USERS POLICIES
DROP POLICY IF EXISTS "Users can view own tenant memberships" ON tenant_users;
CREATE POLICY "Users can view own tenant memberships"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Admins can manage tenant users" ON tenant_users;
CREATE POLICY "Admins can manage tenant users"
  ON tenant_users FOR ALL
  TO authenticated
  USING (
    tenant_id IN (SELECT get_user_tenant_ids())
    AND user_has_role('tenant_admin')
  );

-- CATEGORIES POLICIES
DROP POLICY IF EXISTS "Users can view categories in their tenant" ON categories;
CREATE POLICY "Users can view categories in their tenant"
  ON categories FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Managers can manage categories" ON categories;
CREATE POLICY "Managers can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- PRODUCTS POLICIES
DROP POLICY IF EXISTS "Users can view products in their tenant" ON products;
CREATE POLICY "Users can view products in their tenant"
  ON products FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Managers can manage products" ON products;
CREATE POLICY "Managers can manage products"
  ON products FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- INVENTORY POLICIES
DROP POLICY IF EXISTS "Users can view inventory" ON inventory;
CREATE POLICY "Users can view inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Managers can manage inventory" ON inventory;
CREATE POLICY "Managers can manage inventory"
  ON inventory FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- CUSTOMERS POLICIES
DROP POLICY IF EXISTS "Users can view customers" ON customers;
CREATE POLICY "Users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Staff can manage customers" ON customers;
CREATE POLICY "Staff can manage customers"
  ON customers FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- TRANSACTIONS POLICIES
DROP POLICY IF EXISTS "Users can view transactions" ON transactions;
CREATE POLICY "Users can view transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Cashiers can create transactions" ON transactions;
CREATE POLICY "Cashiers can create transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT get_user_tenant_ids())
    AND cashier_id = auth.uid()
  );

-- TRANSACTION_ITEMS POLICIES
DROP POLICY IF EXISTS "Users can view transaction items" ON transaction_items;
CREATE POLICY "Users can view transaction items"
  ON transaction_items FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Cashiers can create transaction items" ON transaction_items;
CREATE POLICY "Cashiers can create transaction items"
  ON transaction_items FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids()));

-- PROMOTIONS POLICIES
DROP POLICY IF EXISTS "Users can view promotions" ON promotions;
CREATE POLICY "Users can view promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Managers can manage promotions" ON promotions;
CREATE POLICY "Managers can manage promotions"
  ON promotions FOR ALL
  TO authenticated
  USING (tenant_id IN (SELECT get_user_tenant_ids()));

-- ========================================
-- STEP 5: Create Storage Bucket
-- ========================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Public images viewable" ON storage.objects;
CREATE POLICY "Public images viewable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
CREATE POLICY "Users can update own images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
CREATE POLICY "Users can delete own images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ========================================
-- DONE! Database is ready
-- ========================================

SELECT 'Database setup completed successfully!' as status;
