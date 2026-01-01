-- Update ports from individual columns to JSONB array
-- This migration changes the transportation structure to support multiple ports with container prices

-- Drop old container columns if they exist
ALTER TABLE warehouses 
DROP COLUMN IF EXISTS container_40_dc,
DROP COLUMN IF EXISTS container_40_hc,
DROP COLUMN IF EXISTS container_20_dc;

-- Add ports JSONB column if it doesn't exist
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS ports JSONB DEFAULT '[]'::jsonb;

-- Update comment
COMMENT ON COLUMN warehouses.ports IS 'Array of ports with name and container prices. Format: [{"name": "Port Name", "container40DC": 100.00, "container40HC": 120.00, "container20DC": 80.00}, ...]';

