-- Add warehouse type, storage type, and temperature fields to warehouses table
-- These fields are used for filtering warehouses on the search page

ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS warehouse_type TEXT,
ADD COLUMN IF NOT EXISTS storage_types TEXT[],
ADD COLUMN IF NOT EXISTS temperature_types TEXT[];

-- Add comment to explain the fields
COMMENT ON COLUMN warehouses.warehouse_type IS 'Primary warehouse type: general, food-and-beverages, dangerous-goods, chemicals, medical, pharma';
COMMENT ON COLUMN warehouses.storage_types IS 'Array of storage types: bulk-space, rack-space, individual-unit, lockable-unit, cage, open-yard, closed-yard';
COMMENT ON COLUMN warehouses.temperature_types IS 'Array of temperature options: air-conditioned, non-air-conditioned, ambient, chilled, cold-storage, frozen, cool-storage, open-area';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_warehouses_warehouse_type ON warehouses(warehouse_type);
CREATE INDEX IF NOT EXISTS idx_warehouses_storage_types ON warehouses USING GIN(storage_types);
CREATE INDEX IF NOT EXISTS idx_warehouses_temperature_types ON warehouses USING GIN(temperature_types);

