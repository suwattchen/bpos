-- Create Admin User Script
-- Run this after initial database setup

-- 1. Create admin user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  gen_random_uuid(),
  'admin@yourcompany.com',  -- Change this email
  crypt('Admin123456', gen_salt('bf')),  -- Change this password
  NOW(),
  '{"name": "System Admin"}'::jsonb
)
ON CONFLICT (email) DO NOTHING
RETURNING id;

-- 2. Get the user ID (will be needed for next step)
-- Save this ID from the result above

-- 3. The trigger will automatically:
--    - Create a tenant
--    - Link user to tenant with 'owner' role

-- Verify the user was created:
SELECT
  u.id,
  u.email,
  tu.tenant_id,
  tu.role,
  t.name as tenant_name
FROM auth.users u
LEFT JOIN tenant_users tu ON tu.user_id = u.id
LEFT JOIN tenants t ON t.id = tu.tenant_id
WHERE u.email = 'admin@yourcompany.com';

-- Expected output:
-- id                                   | email                    | tenant_id                            | role  | tenant_name
-- -------------------------------------|--------------------------|--------------------------------------|-------|------------------
-- xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx | admin@yourcompany.com   | yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy | owner | admin@yourcompany.com's Business
