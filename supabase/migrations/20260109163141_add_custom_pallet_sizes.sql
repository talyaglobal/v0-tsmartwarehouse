-- Migration: Add support for multiple custom pallet sizes
-- Purpose: Allow multiple sizes (length x width) for custom pallets, each with its own height ranges
-- 
-- Strategy: 
-- 1. Create a new table for custom pallet sizes
-- 2. Each size can have its own height ranges
-- 3. Keep backward compatibility with existing single custom dimension structure

-- =====================================================
-- PART 1: CREATE warehouse_custom_pallet_sizes TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS warehouse_custom_pallet_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_pricing_id UUID NOT NULL REFERENCES warehouse_pallet_pricing(id) ON DELETE CASCADE,
  length_cm INTEGER NOT NULL CHECK (length_cm > 0),
  width_cm INTEGER NOT NULL CHECK (width_cm > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(pallet_pricing_id, length_cm, width_cm)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_custom_pallet_sizes_pallet_pricing_id 
ON warehouse_custom_pallet_sizes(pallet_pricing_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_custom_pallet_sizes_status 
ON warehouse_custom_pallet_sizes(status) WHERE status = true;

COMMENT ON TABLE warehouse_custom_pallet_sizes IS 'Multiple custom pallet sizes (length x width) for a custom pallet pricing configuration';
COMMENT ON COLUMN warehouse_custom_pallet_sizes.length_cm IS 'Pallet length in cm';
COMMENT ON COLUMN warehouse_custom_pallet_sizes.width_cm IS 'Pallet width in cm';

-- =====================================================
-- PART 2: CREATE warehouse_custom_pallet_size_height_pricing TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS warehouse_custom_pallet_size_height_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_pallet_size_id UUID NOT NULL REFERENCES warehouse_custom_pallet_sizes(id) ON DELETE CASCADE,
  height_min_cm INTEGER NOT NULL CHECK (height_min_cm >= 0),
  height_max_cm INTEGER NOT NULL CHECK (height_max_cm > height_min_cm),
  price_per_unit DECIMAL(10,2) NOT NULL CHECK (price_per_unit > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(custom_pallet_size_id, height_min_cm, height_max_cm)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_custom_pallet_size_height_pricing_size_id 
ON warehouse_custom_pallet_size_height_pricing(custom_pallet_size_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_custom_pallet_size_height_pricing_status 
ON warehouse_custom_pallet_size_height_pricing(status) WHERE status = true;

COMMENT ON TABLE warehouse_custom_pallet_size_height_pricing IS 'Height range pricing for each custom pallet size';
COMMENT ON COLUMN warehouse_custom_pallet_size_height_pricing.height_min_cm IS 'Minimum height in cm (inclusive)';
COMMENT ON COLUMN warehouse_custom_pallet_size_height_pricing.height_max_cm IS 'Maximum height in cm (exclusive)';
COMMENT ON COLUMN warehouse_custom_pallet_size_height_pricing.price_per_unit IS 'Price per pallet for this height range';

-- =====================================================
-- PART 3: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE warehouse_custom_pallet_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_custom_pallet_size_height_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for warehouse_custom_pallet_sizes
CREATE POLICY "Warehouse owners can manage custom pallet sizes"
  ON warehouse_custom_pallet_sizes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_pallet_pricing wpp
      JOIN warehouses w ON w.id = wpp.warehouse_id
      WHERE wpp.id = warehouse_custom_pallet_sizes.pallet_pricing_id
      AND w.owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can view custom pallet sizes"
  ON warehouse_custom_pallet_sizes FOR SELECT
  USING (status = true);

-- RLS Policies for warehouse_custom_pallet_size_height_pricing
CREATE POLICY "Warehouse owners can manage custom pallet size height pricing"
  ON warehouse_custom_pallet_size_height_pricing FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_custom_pallet_sizes wcps
      JOIN warehouse_pallet_pricing wpp ON wpp.id = wcps.pallet_pricing_id
      JOIN warehouses w ON w.id = wpp.warehouse_id
      WHERE wcps.id = warehouse_custom_pallet_size_height_pricing.custom_pallet_size_id
      AND w.owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can view custom pallet size height pricing"
  ON warehouse_custom_pallet_size_height_pricing FOR SELECT
  USING (status = true);

-- =====================================================
-- PART 4: ADD TRIGGERS FOR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_warehouse_custom_pallet_sizes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_warehouse_custom_pallet_sizes_updated_at
BEFORE UPDATE ON warehouse_custom_pallet_sizes
FOR EACH ROW
EXECUTE FUNCTION update_warehouse_custom_pallet_sizes_updated_at();

CREATE OR REPLACE FUNCTION update_warehouse_custom_pallet_size_height_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_warehouse_custom_pallet_size_height_pricing_updated_at
BEFORE UPDATE ON warehouse_custom_pallet_size_height_pricing
FOR EACH ROW
EXECUTE FUNCTION update_warehouse_custom_pallet_size_height_pricing_updated_at();

