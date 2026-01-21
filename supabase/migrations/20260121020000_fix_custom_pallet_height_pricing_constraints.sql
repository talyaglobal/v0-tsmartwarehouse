-- Migration: Fix constraints for custom pallet size height pricing
-- Purpose: Allow NULL for height_max_cm (infinity) and fix column types

-- Remove NOT NULL constraint from height_max_cm
ALTER TABLE warehouse_custom_pallet_size_height_pricing 
ALTER COLUMN height_max_cm DROP NOT NULL;

-- Drop the existing check constraint
ALTER TABLE warehouse_custom_pallet_size_height_pricing 
DROP CONSTRAINT IF EXISTS warehouse_custom_pallet_size_height_pricing_height_max_cm_check;

-- Change column types to NUMERIC for decimal values
ALTER TABLE warehouse_custom_pallet_size_height_pricing
ALTER COLUMN height_min_cm TYPE NUMERIC,
ALTER COLUMN height_max_cm TYPE NUMERIC;

-- Change custom pallet sizes columns to NUMERIC
ALTER TABLE warehouse_custom_pallet_sizes
ALTER COLUMN length_cm TYPE NUMERIC,
ALTER COLUMN width_cm TYPE NUMERIC,
ALTER COLUMN length_min_cm TYPE NUMERIC,
ALTER COLUMN length_max_cm TYPE NUMERIC,
ALTER COLUMN width_min_cm TYPE NUMERIC,
ALTER COLUMN width_max_cm TYPE NUMERIC;

-- Update unique constraint to handle ranges
ALTER TABLE warehouse_custom_pallet_size_height_pricing
DROP CONSTRAINT IF EXISTS warehouse_custom_pallet_size_height_pricing_custom_pallet_si_key;
