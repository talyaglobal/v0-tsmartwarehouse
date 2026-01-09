-- Migration 114: Create Pallet Pricing Tables
-- Created: 2025-01-XX
-- Purpose: Create normalized tables for pallet pricing with height and weight ranges

-- =====================================================
-- PART 1: CREATE warehouse_pallet_pricing TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS warehouse_pallet_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  pallet_type TEXT NOT NULL CHECK (pallet_type IN ('euro', 'standard', 'custom')),
  pricing_period TEXT NOT NULL CHECK (pricing_period IN ('day', 'week', 'month')),
  custom_length_cm INTEGER, -- For custom pallet type
  custom_width_cm INTEGER, -- For custom pallet type
  custom_height_cm INTEGER, -- For custom pallet type
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(warehouse_id, pallet_type, pricing_period, custom_length_cm, custom_width_cm, custom_height_cm)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_pallet_pricing_warehouse_id 
ON warehouse_pallet_pricing(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_pallet_pricing_pallet_type 
ON warehouse_pallet_pricing(pallet_type);

CREATE INDEX IF NOT EXISTS idx_warehouse_pallet_pricing_status 
ON warehouse_pallet_pricing(status) WHERE status = true;

COMMENT ON TABLE warehouse_pallet_pricing IS 'Base pallet pricing configuration per warehouse, pallet type, and pricing period';
COMMENT ON COLUMN warehouse_pallet_pricing.pallet_type IS 'Type of pallet: euro, standard, or custom';
COMMENT ON COLUMN warehouse_pallet_pricing.pricing_period IS 'Pricing period: day, week, or month';
COMMENT ON COLUMN warehouse_pallet_pricing.custom_length_cm IS 'Custom pallet length in cm (only for custom pallet type)';
COMMENT ON COLUMN warehouse_pallet_pricing.custom_width_cm IS 'Custom pallet width in cm (only for custom pallet type)';
COMMENT ON COLUMN warehouse_pallet_pricing.custom_height_cm IS 'Custom pallet height in cm (only for custom pallet type)';

-- =====================================================
-- PART 2: CREATE warehouse_pallet_height_pricing TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS warehouse_pallet_height_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_pricing_id UUID NOT NULL REFERENCES warehouse_pallet_pricing(id) ON DELETE CASCADE,
  height_min_cm INTEGER NOT NULL CHECK (height_min_cm >= 0),
  height_max_cm INTEGER NOT NULL CHECK (height_max_cm > height_min_cm),
  price_per_unit DECIMAL(10,2) NOT NULL CHECK (price_per_unit > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(pallet_pricing_id, height_min_cm, height_max_cm)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_pallet_height_pricing_pallet_pricing_id 
ON warehouse_pallet_height_pricing(pallet_pricing_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_pallet_height_pricing_status 
ON warehouse_pallet_height_pricing(status) WHERE status = true;

COMMENT ON TABLE warehouse_pallet_height_pricing IS 'Pricing based on pallet height ranges';
COMMENT ON COLUMN warehouse_pallet_height_pricing.height_min_cm IS 'Minimum height in cm (inclusive)';
COMMENT ON COLUMN warehouse_pallet_height_pricing.height_max_cm IS 'Maximum height in cm (exclusive)';
COMMENT ON COLUMN warehouse_pallet_height_pricing.price_per_unit IS 'Price per pallet for this height range';

-- =====================================================
-- PART 3: CREATE warehouse_pallet_weight_pricing TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS warehouse_pallet_weight_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_pricing_id UUID NOT NULL REFERENCES warehouse_pallet_pricing(id) ON DELETE CASCADE,
  weight_min_kg DECIMAL(10,2) NOT NULL CHECK (weight_min_kg >= 0),
  weight_max_kg DECIMAL(10,2) NOT NULL CHECK (weight_max_kg > weight_min_kg),
  price_per_pallet DECIMAL(10,2) NOT NULL CHECK (price_per_pallet > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(pallet_pricing_id, weight_min_kg, weight_max_kg)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_pallet_weight_pricing_pallet_pricing_id 
ON warehouse_pallet_weight_pricing(pallet_pricing_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_pallet_weight_pricing_status 
ON warehouse_pallet_weight_pricing(status) WHERE status = true;

COMMENT ON TABLE warehouse_pallet_weight_pricing IS 'Pricing based on pallet weight ranges (per pallet)';
COMMENT ON COLUMN warehouse_pallet_weight_pricing.weight_min_kg IS 'Minimum weight in kg (inclusive)';
COMMENT ON COLUMN warehouse_pallet_weight_pricing.weight_max_kg IS 'Maximum weight in kg (exclusive)';
COMMENT ON COLUMN warehouse_pallet_weight_pricing.price_per_pallet IS 'Additional price per pallet for this weight range';

-- =====================================================
-- PART 4: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE warehouse_pallet_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_pallet_height_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_pallet_weight_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for warehouse_pallet_pricing
CREATE POLICY "Warehouse owners can manage their pallet pricing"
  ON warehouse_pallet_pricing FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM warehouses
      WHERE warehouses.id = warehouse_pallet_pricing.warehouse_id
      AND warehouses.owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can view pallet pricing"
  ON warehouse_pallet_pricing FOR SELECT
  USING (status = true);

-- RLS Policies for warehouse_pallet_height_pricing
CREATE POLICY "Warehouse owners can manage height pricing"
  ON warehouse_pallet_height_pricing FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_pallet_pricing wpp
      JOIN warehouses w ON w.id = wpp.warehouse_id
      WHERE wpp.id = warehouse_pallet_height_pricing.pallet_pricing_id
      AND w.owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can view height pricing"
  ON warehouse_pallet_height_pricing FOR SELECT
  USING (status = true);

-- RLS Policies for warehouse_pallet_weight_pricing
CREATE POLICY "Warehouse owners can manage weight pricing"
  ON warehouse_pallet_weight_pricing FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM warehouse_pallet_pricing wpp
      JOIN warehouses w ON w.id = wpp.warehouse_id
      WHERE wpp.id = warehouse_pallet_weight_pricing.pallet_pricing_id
      AND w.owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Anyone can view weight pricing"
  ON warehouse_pallet_weight_pricing FOR SELECT
  USING (status = true);

-- =====================================================
-- PART 5: ADD TRIGGERS FOR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_warehouse_pallet_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_warehouse_pallet_pricing_updated_at
BEFORE UPDATE ON warehouse_pallet_pricing
FOR EACH ROW
EXECUTE FUNCTION update_warehouse_pallet_pricing_updated_at();

CREATE OR REPLACE FUNCTION update_warehouse_pallet_height_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_warehouse_pallet_height_pricing_updated_at
BEFORE UPDATE ON warehouse_pallet_height_pricing
FOR EACH ROW
EXECUTE FUNCTION update_warehouse_pallet_height_pricing_updated_at();

CREATE OR REPLACE FUNCTION update_warehouse_pallet_weight_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_warehouse_pallet_weight_pricing_updated_at
BEFORE UPDATE ON warehouse_pallet_weight_pricing
FOR EACH ROW
EXECUTE FUNCTION update_warehouse_pallet_weight_pricing_updated_at();

