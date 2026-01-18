-- Migration: Rename warehouse_type to goods_type
-- This migration renames the warehouse_type column to goods_type in the warehouses table

-- Rename the column
ALTER TABLE warehouses 
RENAME COLUMN warehouse_type TO goods_type;

-- Update any comments
COMMENT ON COLUMN warehouses.goods_type IS 'Array of goods types that can be stored in this warehouse (e.g., FMCG, Food Stuff, Pharmaceutical, etc.)';
