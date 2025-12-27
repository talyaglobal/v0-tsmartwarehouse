-- Add working days field to warehouses table
-- Migration: 082_add_working_days_to_warehouses.sql

-- Add working days as TEXT array (stores day names like 'Monday', 'Tuesday', etc.)
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS working_days TEXT[];

-- Add comment to explain the field
COMMENT ON COLUMN warehouses.working_days IS 'Array of working days (e.g., Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)';

