-- Migration: Add unstackable_method and unstackable_value columns to height and weight pricing tables
-- These fields allow per-range unstackable price calculation

-- Add columns to warehouse_pallet_height_pricing table
ALTER TABLE warehouse_pallet_height_pricing 
ADD COLUMN IF NOT EXISTS unstackable_method TEXT DEFAULT 'rate' CHECK (unstackable_method IN ('rate', 'plus_per_unit')),
ADD COLUMN IF NOT EXISTS unstackable_value NUMERIC DEFAULT 0;

-- Add columns to warehouse_pallet_weight_pricing table
ALTER TABLE warehouse_pallet_weight_pricing 
ADD COLUMN IF NOT EXISTS unstackable_method TEXT DEFAULT 'rate' CHECK (unstackable_method IN ('rate', 'plus_per_unit')),
ADD COLUMN IF NOT EXISTS unstackable_value NUMERIC DEFAULT 0;

-- Add columns to warehouse_custom_pallet_size_height_pricing table (for custom pallet sizes)
ALTER TABLE warehouse_custom_pallet_size_height_pricing 
ADD COLUMN IF NOT EXISTS unstackable_method TEXT DEFAULT 'rate' CHECK (unstackable_method IN ('rate', 'plus_per_unit')),
ADD COLUMN IF NOT EXISTS unstackable_value NUMERIC DEFAULT 0;

-- Add comments
COMMENT ON COLUMN warehouse_pallet_height_pricing.unstackable_method IS 'Method for calculating unstackable price: rate (percentage) or plus_per_unit (fixed amount)';
COMMENT ON COLUMN warehouse_pallet_height_pricing.unstackable_value IS 'Value for unstackable calculation: percentage rate or fixed USD amount';
COMMENT ON COLUMN warehouse_pallet_weight_pricing.unstackable_method IS 'Method for calculating unstackable price: rate (percentage) or plus_per_unit (fixed amount)';
COMMENT ON COLUMN warehouse_pallet_weight_pricing.unstackable_value IS 'Value for unstackable calculation: percentage rate or fixed USD amount';
COMMENT ON COLUMN warehouse_custom_pallet_size_height_pricing.unstackable_method IS 'Method for calculating unstackable price: rate (percentage) or plus_per_unit (fixed amount)';
COMMENT ON COLUMN warehouse_custom_pallet_size_height_pricing.unstackable_value IS 'Value for unstackable calculation: percentage rate or fixed USD amount';
