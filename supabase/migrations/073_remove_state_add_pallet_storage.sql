-- Remove state column from warehouses table and add total_pallet_storage column
-- Migration: 073_remove_state_add_pallet_storage

-- Add total_pallet_storage column first (before removing state)
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS total_pallet_storage INTEGER;

-- Remove state column
-- Note: This will fail if there are dependencies or views referencing this column
-- You may need to update any views, functions, or constraints first
ALTER TABLE warehouses 
DROP COLUMN IF EXISTS state;

-- Update any existing warehouses to have a default pallet storage capacity if needed
-- This is optional - adjust based on your business logic
-- UPDATE warehouses SET total_pallet_storage = 1000 WHERE total_pallet_storage IS NULL;

COMMENT ON COLUMN warehouses.total_pallet_storage IS 'Total pallet storage capacity for this warehouse';

