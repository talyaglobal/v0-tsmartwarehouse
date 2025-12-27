-- Add video, access information, and product acceptance hours to warehouses table
-- Migration: 080_add_warehouse_video_access_acceptance.sql

-- Add video URL/path field (optional)
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add access to warehouse information (JSONB for flexible structure)
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS access_info JSONB;

-- Add product acceptance hours (TIME type for start and end times)
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS product_acceptance_start_time TIME;
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS product_acceptance_end_time TIME;

-- Add comments to explain the fields
COMMENT ON COLUMN warehouses.video_url IS 'URL or path to warehouse video (optional)';
COMMENT ON COLUMN warehouses.access_info IS 'JSON object containing access information (access type, access control, appointment required, etc.)';
COMMENT ON COLUMN warehouses.product_acceptance_start_time IS 'Start time for product acceptance (e.g., 08:00)';
COMMENT ON COLUMN warehouses.product_acceptance_end_time IS 'End time for product acceptance (e.g., 18:00)';

