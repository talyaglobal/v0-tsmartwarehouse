-- Add stackable/unstackable adjustment fields to pallet pricing
ALTER TABLE warehouse_pallet_pricing
ADD COLUMN IF NOT EXISTS stackable_adjustment_type TEXT DEFAULT 'plus_per_unit',
ADD COLUMN IF NOT EXISTS stackable_adjustment_value NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unstackable_adjustment_type TEXT DEFAULT 'plus_per_unit',
ADD COLUMN IF NOT EXISTS unstackable_adjustment_value NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN warehouse_pallet_pricing.stackable_adjustment_type IS 'Adjustment type for stackable pallets: rate or plus_per_unit';
COMMENT ON COLUMN warehouse_pallet_pricing.stackable_adjustment_value IS 'Adjustment value for stackable pallets';
COMMENT ON COLUMN warehouse_pallet_pricing.unstackable_adjustment_type IS 'Adjustment type for unstackable pallets: rate or plus_per_unit';
COMMENT ON COLUMN warehouse_pallet_pricing.unstackable_adjustment_value IS 'Adjustment value for unstackable pallets';
