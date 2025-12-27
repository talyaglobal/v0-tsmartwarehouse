-- Convert warehouse_type from TEXT to TEXT[] to support multiple warehouse types
-- Migration: 079_convert_warehouse_type_to_array.sql

-- First, create a temporary column with TEXT[] type
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS warehouse_type_new TEXT[];

-- Copy existing values to the new column as arrays
UPDATE warehouses
SET warehouse_type_new = CASE
  WHEN warehouse_type IS NULL OR warehouse_type = '' THEN NULL
  ELSE ARRAY[warehouse_type]
END;

-- Drop the old column
ALTER TABLE warehouses
DROP COLUMN IF EXISTS warehouse_type;

-- Rename the new column to the original name
ALTER TABLE warehouses
RENAME COLUMN warehouse_type_new TO warehouse_type;

-- Update the comment
COMMENT ON COLUMN warehouses.warehouse_type IS 'Array of warehouse types: general, food-and-beverages, dangerous-goods, chemicals, medical, pharma';

-- Drop the old index if it exists (it won't work on arrays)
DROP INDEX IF EXISTS idx_warehouses_warehouse_type;

-- Create a GIN index for array searches
CREATE INDEX IF NOT EXISTS idx_warehouses_warehouse_type ON warehouses USING GIN(warehouse_type);

