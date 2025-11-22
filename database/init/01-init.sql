-- ========================================
-- Multi-Tenant POS System - PostgreSQL Setup
-- ========================================
-- For self-hosted PostgreSQL (not Supabase)
-- Auto-runs on first container startup

-- Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- STEP 1: Create Auth Schema and Tables
-- ========================================
-- (For non-Supabase deployments, we manage users ourselves)

CREATE SCHEMA IF NOT EXISTS auth;

-- Auth Users Table
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  encrypted_password text NOT NULL,
  email_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  last_sign_in_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);

-- ========================================
-- STEP 2: Create Core Tables
-- ========================================

-- 2.1 TENANTS TABLE
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('active', 'suspended', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

-- 2.2 TENANT USERS TABLE
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

-- 2.3 CATEGORIES TABLE
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

-- 2.4 PRODUCTS TABLE
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

-- 2.5 INVENTORY TABLE
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
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location);

-- 2.6 CUSTOMERS TABLE
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
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;

-- 2.7 TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_number text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  cashier_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
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
CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_number ON transactions(tenant_id, transaction_number);

-- 2.8 TRANSACTION ITEMS TABLE
CREATE TABLE IF NOT EXISTS transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  discount_amount decimal(10,2) DEFAULT 0,
  tax_amount decimal(10,2) DEFAULT 0,
  subtotal decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_tenant ON transaction_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON transaction_items(product_id);

-- ========================================
-- STEP 3: Create Functions & Triggers
-- ========================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auth_users_updated_at
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: Auto-create tenant on user signup
CREATE OR REPLACE FUNCTION auto_create_tenant_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id uuid;
  tenant_slug text;
BEGIN
  -- Generate unique slug from email
  tenant_slug := split_part(NEW.email, '@', 1) || '-' || substr(md5(random()::text), 1, 8);

  -- Create new tenant
  INSERT INTO tenants (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    tenant_slug
  )
  RETURNING id INTO new_tenant_id;

  -- Link user to tenant as owner
  INSERT INTO tenant_users (tenant_id, user_id, role)
  VALUES (new_tenant_id, NEW.id, 'tenant_admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create tenant when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_tenant_on_signup();

-- Function: Decrease inventory on sale
CREATE OR REPLACE FUNCTION decrease_inventory_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory
  SET quantity = quantity - NEW.quantity,
      last_updated = now()
  WHERE tenant_id = NEW.tenant_id
    AND product_id = NEW.product_id
    AND location = 'main';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-decrease inventory
CREATE TRIGGER on_transaction_item_created
  AFTER INSERT ON transaction_items
  FOR EACH ROW
  EXECUTE FUNCTION decrease_inventory_on_transaction();

-- ========================================
-- STEP 4: Insert Sample Data (Optional)
-- ========================================

-- Create default admin user (password: admin123)
-- Only if no users exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
    INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
    VALUES (
      'admin@pos.local',
      crypt('admin123', gen_salt('bf')),
      now(),
      '{"name": "System Admin"}'::jsonb
    );
  END IF;
END $$;

-- ========================================
-- STEP 5: Create Views for Convenience
-- ========================================

-- View: User with tenant info
CREATE OR REPLACE VIEW user_tenants AS
SELECT
  u.id as user_id,
  u.email,
  u.raw_user_meta_data->>'name' as user_name,
  tu.role,
  tu.is_active,
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.subscription_status
FROM auth.users u
LEFT JOIN tenant_users tu ON tu.user_id = u.id
LEFT JOIN tenants t ON t.id = tu.tenant_id;

-- View: Product with inventory
CREATE OR REPLACE VIEW products_with_inventory AS
SELECT
  p.*,
  c.name as category_name,
  COALESCE(i.quantity, 0) as stock_quantity,
  COALESCE(i.reorder_level, 10) as reorder_level,
  CASE WHEN COALESCE(i.quantity, 0) <= COALESCE(i.reorder_level, 10)
    THEN true ELSE false
  END as needs_reorder
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN inventory i ON i.product_id = p.id AND i.location = 'main';

-- View: Transaction summary
CREATE OR REPLACE VIEW transaction_summary AS
SELECT
  t.*,
  u.email as cashier_email,
  u.raw_user_meta_data->>'name' as cashier_name,
  c.name as customer_name,
  COUNT(ti.id) as item_count,
  SUM(ti.quantity) as total_items
FROM transactions t
LEFT JOIN auth.users u ON u.id = t.cashier_id
LEFT JOIN customers c ON c.id = t.customer_id
LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
GROUP BY t.id, u.email, u.raw_user_meta_data, c.name;

-- ========================================
-- STEP 6: Grant Permissions
-- ========================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT USAGE ON SCHEMA auth TO PUBLIC;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO PUBLIC;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO PUBLIC;

-- ========================================
-- Database Setup Complete
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'POS Database Setup Completed';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables Created: 10';
  RAISE NOTICE 'Indexes Created: 25+';
  RAISE NOTICE 'Triggers Created: 6';
  RAISE NOTICE 'Views Created: 3';
  RAISE NOTICE '';
  RAISE NOTICE 'Default Admin Account:';
  RAISE NOTICE '  Email: admin@pos.local';
  RAISE NOTICE '  Password: admin123';
  RAISE NOTICE '  (Change immediately after first login!)';
  RAISE NOTICE '========================================';
END $$;
