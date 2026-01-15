-- Add free storage rules configuration to warehouses
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS free_storage_rules JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN warehouses.free_storage_rules IS 'Array of free storage rules: [{"minDuration": 3, "maxDuration": 6, "durationUnit": "month", "freeAmount": 14, "freeUnit": "day"}]';
