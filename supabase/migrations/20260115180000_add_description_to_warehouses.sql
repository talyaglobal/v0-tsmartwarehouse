-- Add description field to warehouses
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN warehouses.description IS 'Optional warehouse description';
