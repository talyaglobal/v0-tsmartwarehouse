-- Add warehouse fees and transportation fields to warehouses table
-- This migration adds:
-- 1. warehouse_in_fee: Fee for bringing items into the warehouse
-- 2. warehouse_out_fee: Fee for taking items out of the warehouse
-- 3. need_transportation: Boolean flag indicating if warehouse offers transportation
-- 4. ports: JSONB array of ports with name and price for transportation

-- Add warehouse fees
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS warehouse_in_fee DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS warehouse_out_fee DECIMAL(10,2);

-- Add transportation fields
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS ports JSONB DEFAULT '[]'::jsonb;

-- Add comments
COMMENT ON COLUMN warehouses.warehouse_in_fee IS 'Fee charged per unit (pallet/sqft) when items are brought into the warehouse';
COMMENT ON COLUMN warehouses.warehouse_out_fee IS 'Fee charged per unit (pallet/sqft) when items are taken out of the warehouse';
COMMENT ON COLUMN warehouses.ports IS 'Array of ports with name and container prices. Format: [{"name": "Port Name", "container40DC": 100.00, "container40HC": 120.00, "container20DC": 80.00}, ...]';

