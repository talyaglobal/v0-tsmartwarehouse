-- TSmart Warehouse Management System - Customer Stock Levels Tracking
-- Aggregates inventory by customer for stock level monitoring
-- Generated: December 2024

-- ============================================
-- CUSTOMER STOCK LEVELS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customer_stock_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  total_pallets INTEGER NOT NULL DEFAULT 0,
  active_pallets INTEGER NOT NULL DEFAULT 0,
  in_transit_pallets INTEGER NOT NULL DEFAULT 0,
  stored_pallets INTEGER NOT NULL DEFAULT 0,
  shipped_pallets INTEGER NOT NULL DEFAULT 0,
  damaged_pallets INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_levels_customer_id ON customer_stock_levels(customer_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_warehouse_id ON customer_stock_levels(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_last_updated ON customer_stock_levels(last_updated);

-- ============================================
-- FUNCTION: Update Customer Stock Levels
-- ============================================
CREATE OR REPLACE FUNCTION update_customer_stock_levels(
  p_customer_id UUID DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO customer_stock_levels (
    customer_id,
    warehouse_id,
    total_pallets,
    active_pallets,
    in_transit_pallets,
    stored_pallets,
    shipped_pallets,
    damaged_pallets,
    last_updated
  )
  SELECT 
    i.customer_id,
    i.warehouse_id,
    COUNT(*)::INTEGER AS total_pallets,
    COUNT(*) FILTER (WHERE i.status IN ('received', 'stored', 'moved'))::INTEGER AS active_pallets,
    COUNT(*) FILTER (WHERE i.status = 'in-transit')::INTEGER AS in_transit_pallets,
    COUNT(*) FILTER (WHERE i.status = 'stored')::INTEGER AS stored_pallets,
    COUNT(*) FILTER (WHERE i.status = 'shipped')::INTEGER AS shipped_pallets,
    COUNT(*) FILTER (WHERE i.status = 'damaged')::INTEGER AS damaged_pallets,
    NOW() AS last_updated
  FROM inventory_items i
  WHERE (p_customer_id IS NULL OR i.customer_id = p_customer_id)
    AND (p_warehouse_id IS NULL OR i.warehouse_id = p_warehouse_id)
  GROUP BY i.customer_id, i.warehouse_id
  ON CONFLICT (customer_id, warehouse_id) 
  DO UPDATE SET
    total_pallets = EXCLUDED.total_pallets,
    active_pallets = EXCLUDED.active_pallets,
    in_transit_pallets = EXCLUDED.in_transit_pallets,
    stored_pallets = EXCLUDED.stored_pallets,
    shipped_pallets = EXCLUDED.shipped_pallets,
    damaged_pallets = EXCLUDED.damaged_pallets,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Update stock levels on inventory changes
-- ============================================
CREATE OR REPLACE FUNCTION update_customer_stock_levels_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stock levels for the affected customer/warehouse
  PERFORM update_customer_stock_levels(
    COALESCE(NEW.customer_id, OLD.customer_id),
    COALESCE(NEW.warehouse_id, OLD.warehouse_id)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_stock_levels_trigger
  AFTER INSERT OR UPDATE OR DELETE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stock_levels_trigger();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE customer_stock_levels ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be configured separately

