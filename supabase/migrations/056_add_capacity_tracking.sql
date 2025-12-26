-- TSmart Warehouse Management System - Capacity Tracking
-- Track capacity utilization over time at warehouse, zone, and customer levels
-- Generated: December 2024

-- ============================================
-- WAREHOUSE CAPACITY SNAPSHOTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS warehouse_capacity_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES warehouse_zones(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  total_capacity INTEGER NOT NULL, -- Total capacity (pallets or sq_ft)
  used_capacity INTEGER NOT NULL DEFAULT 0, -- Used capacity
  percentage_used DECIMAL(5, 2) NOT NULL DEFAULT 0, -- Percentage (0-100)
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_warehouse_id ON warehouse_capacity_snapshots(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_zone_id ON warehouse_capacity_snapshots(zone_id);
CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_customer_id ON warehouse_capacity_snapshots(customer_id);
CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_snapshot_date ON warehouse_capacity_snapshots(snapshot_date);

-- ============================================
-- FUNCTION: Calculate Capacity Utilization
-- ============================================
CREATE OR REPLACE FUNCTION calculate_capacity_utilization(
  p_warehouse_id UUID DEFAULT NULL,
  p_zone_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL
)
RETURNS TABLE(
  warehouse_id UUID,
  zone_id UUID,
  customer_id UUID,
  total_capacity INTEGER,
  used_capacity INTEGER,
  percentage_used DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH capacity_data AS (
    SELECT 
      i.warehouse_id,
      i.zone_id,
      i.customer_id,
      COUNT(*)::INTEGER AS used_pallets,
      COALESCE(z.total_slots, 0) AS zone_total_slots,
      COALESCE(z.total_sq_ft, 0) AS zone_total_sq_ft
    FROM inventory_items i
    LEFT JOIN warehouse_zones z ON i.zone_id = z.id
    WHERE i.status IN ('received', 'stored', 'moved')
      AND (p_warehouse_id IS NULL OR i.warehouse_id = p_warehouse_id)
      AND (p_zone_id IS NULL OR i.zone_id = p_zone_id)
      AND (p_customer_id IS NULL OR i.customer_id = p_customer_id)
    GROUP BY i.warehouse_id, i.zone_id, i.customer_id, z.total_slots, z.total_sq_ft
  )
  SELECT 
    cd.warehouse_id,
    cd.zone_id,
    cd.customer_id,
    COALESCE(cd.zone_total_slots, cd.zone_total_sq_ft, 0)::INTEGER AS total_capacity,
    cd.used_pallets AS used_capacity,
    CASE 
      WHEN COALESCE(cd.zone_total_slots, cd.zone_total_sq_ft, 0) > 0 THEN
        ROUND((cd.used_pallets::DECIMAL / GREATEST(COALESCE(cd.zone_total_slots, cd.zone_total_sq_ft, 1), 1)) * 100, 2)
      ELSE 0
    END AS percentage_used
  FROM capacity_data cd;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Create Capacity Snapshot
-- ============================================
CREATE OR REPLACE FUNCTION create_capacity_snapshot(
  p_warehouse_id UUID DEFAULT NULL,
  p_zone_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
  snapshot_id UUID;
  cap_data RECORD;
BEGIN
  -- Get capacity data
  FOR cap_data IN 
    SELECT * FROM calculate_capacity_utilization(p_warehouse_id, p_zone_id, p_customer_id)
  LOOP
    INSERT INTO warehouse_capacity_snapshots (
      warehouse_id,
      zone_id,
      customer_id,
      total_capacity,
      used_capacity,
      percentage_used,
      snapshot_date
    ) VALUES (
      cap_data.warehouse_id,
      cap_data.zone_id,
      cap_data.customer_id,
      cap_data.total_capacity,
      cap_data.used_capacity,
      cap_data.percentage_used,
      p_snapshot_date
    )
    RETURNING id INTO snapshot_id;
  END LOOP;
  
  RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE warehouse_capacity_snapshots ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be configured separately

