-- Fix column types for pallet pricing tables
-- Change INTEGER columns to NUMERIC to support decimal values
-- Remove NOT NULL constraints to allow NULL for "infinity" ranges

-- warehouse_pallet_height_pricing
ALTER TABLE warehouse_pallet_height_pricing
  ALTER COLUMN height_min_cm TYPE NUMERIC USING height_min_cm::NUMERIC,
  ALTER COLUMN height_max_cm TYPE NUMERIC USING height_max_cm::NUMERIC,
  ALTER COLUMN height_max_cm DROP NOT NULL;

-- warehouse_pallet_weight_pricing
ALTER TABLE warehouse_pallet_weight_pricing
  ALTER COLUMN weight_min_kg TYPE NUMERIC USING weight_min_kg::NUMERIC,
  ALTER COLUMN weight_max_kg TYPE NUMERIC USING weight_max_kg::NUMERIC,
  ALTER COLUMN weight_max_kg DROP NOT NULL;

-- warehouse_custom_pallet_sizes
ALTER TABLE warehouse_custom_pallet_sizes
  ALTER COLUMN length_cm TYPE NUMERIC USING length_cm::NUMERIC,
  ALTER COLUMN width_cm TYPE NUMERIC USING width_cm::NUMERIC,
  ALTER COLUMN length_min_cm TYPE NUMERIC USING length_min_cm::NUMERIC,
  ALTER COLUMN length_max_cm TYPE NUMERIC USING length_max_cm::NUMERIC,
  ALTER COLUMN width_min_cm TYPE NUMERIC USING width_min_cm::NUMERIC,
  ALTER COLUMN width_max_cm TYPE NUMERIC USING width_max_cm::NUMERIC;

-- warehouse_custom_pallet_size_height_pricing
ALTER TABLE warehouse_custom_pallet_size_height_pricing
  ALTER COLUMN height_min_cm TYPE NUMERIC USING height_min_cm::NUMERIC,
  ALTER COLUMN height_max_cm TYPE NUMERIC USING height_max_cm::NUMERIC,
  ALTER COLUMN height_max_cm DROP NOT NULL;
