-- Add per-size stackable/unstackable adjustments for custom pallet sizes

ALTER TABLE warehouse_custom_pallet_sizes
  ADD COLUMN IF NOT EXISTS stackable_adjustment_type TEXT,
  ADD COLUMN IF NOT EXISTS stackable_adjustment_value DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS unstackable_adjustment_type TEXT,
  ADD COLUMN IF NOT EXISTS unstackable_adjustment_value DECIMAL(10,2);

UPDATE warehouse_custom_pallet_sizes
SET
  stackable_adjustment_type = COALESCE(stackable_adjustment_type, 'plus_per_unit'),
  stackable_adjustment_value = COALESCE(stackable_adjustment_value, 0),
  unstackable_adjustment_type = COALESCE(unstackable_adjustment_type, 'plus_per_unit'),
  unstackable_adjustment_value = COALESCE(unstackable_adjustment_value, 0)
WHERE
  stackable_adjustment_type IS NULL
  OR stackable_adjustment_value IS NULL
  OR unstackable_adjustment_type IS NULL
  OR unstackable_adjustment_value IS NULL;

ALTER TABLE warehouse_custom_pallet_sizes
  ALTER COLUMN stackable_adjustment_type SET DEFAULT 'plus_per_unit',
  ALTER COLUMN stackable_adjustment_value SET DEFAULT 0,
  ALTER COLUMN unstackable_adjustment_type SET DEFAULT 'plus_per_unit',
  ALTER COLUMN unstackable_adjustment_value SET DEFAULT 0;

COMMENT ON COLUMN warehouse_custom_pallet_sizes.stackable_adjustment_type IS 'Per-size stackable adjustment type (rate or plus_per_unit)';
COMMENT ON COLUMN warehouse_custom_pallet_sizes.stackable_adjustment_value IS 'Per-size stackable adjustment value';
COMMENT ON COLUMN warehouse_custom_pallet_sizes.unstackable_adjustment_type IS 'Per-size unstackable adjustment type (rate or plus_per_unit)';
COMMENT ON COLUMN warehouse_custom_pallet_sizes.unstackable_adjustment_value IS 'Per-size unstackable adjustment value';
