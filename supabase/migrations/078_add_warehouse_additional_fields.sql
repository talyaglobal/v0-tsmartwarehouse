-- Add additional warehouse fields for custom status, capacity, order requirements, rent methods, and security
-- Migration: 078_add_warehouse_additional_fields.sql

-- Add custom status field (antrepolu/regular)
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS custom_status TEXT CHECK (custom_status IN ('antrepolu', 'regular'));

-- Add at capacity flags for sq ft and pallet storage
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS at_capacity_sq_ft BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS at_capacity_pallet BOOLEAN DEFAULT FALSE;

-- Add order requirements (min/max pallet and sq ft)
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS min_pallet INTEGER,
ADD COLUMN IF NOT EXISTS max_pallet INTEGER,
ADD COLUMN IF NOT EXISTS min_sq_ft INTEGER,
ADD COLUMN IF NOT EXISTS max_sq_ft INTEGER;

-- Add customer rent methods (multi-select: pallet, sq_ft)
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS rent_methods TEXT[] DEFAULT '{}';

-- Add security options (multi-select)
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS security TEXT[] DEFAULT '{}';

-- Add comments to explain the fields
COMMENT ON COLUMN warehouses.custom_status IS 'Custom status: antrepolu (bonded warehouse) or regular';
COMMENT ON COLUMN warehouses.at_capacity_sq_ft IS 'Whether the warehouse is at capacity for square feet';
COMMENT ON COLUMN warehouses.at_capacity_pallet IS 'Whether the warehouse is at capacity for pallet storage';
COMMENT ON COLUMN warehouses.min_pallet IS 'Minimum pallet order requirement';
COMMENT ON COLUMN warehouses.max_pallet IS 'Maximum pallet order requirement';
COMMENT ON COLUMN warehouses.min_sq_ft IS 'Minimum square feet order requirement';
COMMENT ON COLUMN warehouses.max_sq_ft IS 'Maximum square feet order requirement';
COMMENT ON COLUMN warehouses.rent_methods IS 'Array of rent methods: pallet, sq_ft';
COMMENT ON COLUMN warehouses.security IS 'Array of security options';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_warehouses_custom_status ON warehouses(custom_status);
CREATE INDEX IF NOT EXISTS idx_warehouses_at_capacity_sq_ft ON warehouses(at_capacity_sq_ft);
CREATE INDEX IF NOT EXISTS idx_warehouses_at_capacity_pallet ON warehouses(at_capacity_pallet);
CREATE INDEX IF NOT EXISTS idx_warehouses_rent_methods ON warehouses USING GIN(rent_methods);
CREATE INDEX IF NOT EXISTS idx_warehouses_security ON warehouses USING GIN(security);

-- Update temperature_types comment to reflect new options
COMMENT ON COLUMN warehouses.temperature_types IS 'Array of temperature options: ambient-with-ac, ambient-without-ac, chilled, frozen, open-area-with-tent, open-area';

