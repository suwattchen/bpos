#!/bin/bash

# Create Admin User Script
# This script creates an admin user for the POS system

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "========================================="
echo "POS System - Create Admin User"
echo "========================================="
echo ""

# Get email
read -p "Enter admin email: " ADMIN_EMAIL
if [ -z "$ADMIN_EMAIL" ]; then
  echo -e "${RED}Email is required${NC}"
  exit 1
fi

# Get password
read -s -p "Enter admin password (min 8 chars): " ADMIN_PASSWORD
echo ""
if [ -z "$ADMIN_PASSWORD" ]; then
  echo -e "${RED}Password is required${NC}"
  exit 1
fi

if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
  echo -e "${RED}Password must be at least 8 characters${NC}"
  exit 1
fi

# Get name (optional)
read -p "Enter admin name (optional): " ADMIN_NAME
if [ -z "$ADMIN_NAME" ]; then
  ADMIN_NAME="System Admin"
fi

echo ""
echo -e "${YELLOW}Creating admin user...${NC}"

# Check if using Docker or local PostgreSQL
if docker ps | grep -q pos-postgres; then
  # Using Docker
  docker exec -i pos-postgres psql -U pos_admin -d pos_system << EOF
-- Create admin user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  gen_random_uuid(),
  '$ADMIN_EMAIL',
  crypt('$ADMIN_PASSWORD', gen_salt('bf')),
  NOW(),
  '{"name": "$ADMIN_NAME"}'::jsonb
)
ON CONFLICT (email) DO NOTHING
RETURNING id, email;

-- Show result
SELECT
  u.email,
  tu.role,
  t.name as tenant_name
FROM auth.users u
LEFT JOIN tenant_users tu ON tu.user_id = u.id
LEFT JOIN tenants t ON t.id = tu.tenant_id
WHERE u.email = '$ADMIN_EMAIL';
EOF
else
  # Using local PostgreSQL
  psql -U pos_admin -d pos_system << EOF
-- Create admin user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  gen_random_uuid(),
  '$ADMIN_EMAIL',
  crypt('$ADMIN_PASSWORD', gen_salt('bf')),
  NOW(),
  '{"name": "$ADMIN_NAME"}'::jsonb
)
ON CONFLICT (email) DO NOTHING
RETURNING id, email;

-- Show result
SELECT
  u.email,
  tu.role,
  t.name as tenant_name
FROM auth.users u
LEFT JOIN tenant_users tu ON tu.user_id = u.id
LEFT JOIN tenants t ON t.id = tu.tenant_id
WHERE u.email = '$ADMIN_EMAIL';
EOF
fi

echo ""
echo -e "${GREEN}✓ Admin user created successfully!${NC}"
echo ""
echo "Credentials:"
echo "  Email:    $ADMIN_EMAIL"
echo "  Password: [hidden]"
echo ""
echo "You can now login at: http://localhost:3000"
echo ""
