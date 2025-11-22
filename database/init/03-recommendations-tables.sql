-- Recommendations Module Tables

-- Purchase patterns tracking
CREATE TABLE IF NOT EXISTS purchase_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  purchase_count INTEGER DEFAULT 0,
  last_purchased TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_patterns_tenant_product ON purchase_patterns(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_patterns_purchase_count ON purchase_patterns(tenant_id, purchase_count DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_patterns_last_purchased ON purchase_patterns(tenant_id, last_purchased DESC);

-- Co-purchase patterns (products bought together)
CREATE TABLE IF NOT EXISTS co_purchase_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  product_id_1 UUID NOT NULL,
  product_id_2 UUID NOT NULL,
  co_purchase_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CHECK (product_id_1 != product_id_2)
);

CREATE INDEX IF NOT EXISTS idx_co_purchase_tenant_products ON co_purchase_patterns(tenant_id, product_id_1, product_id_2);
CREATE INDEX IF NOT EXISTS idx_co_purchase_count ON co_purchase_patterns(tenant_id, co_purchase_count DESC);

-- Stock movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  quantity_change INTEGER NOT NULL,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('sale', 'restock', 'adjustment')),
  old_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);

COMMENT ON TABLE purchase_patterns IS 'Tracks product purchase frequency for recommendations';
COMMENT ON TABLE co_purchase_patterns IS 'Tracks products frequently bought together';
COMMENT ON TABLE stock_movements IS 'Audit trail for all stock changes';
