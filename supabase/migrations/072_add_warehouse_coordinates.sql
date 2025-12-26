-- TSmart Warehouse Management System - Add Warehouse Coordinates
-- Google Maps entegrasyonu için warehouses tablosuna latitude ve longitude alanları ekle

-- ============================================
-- ADD COORDINATES TO WAREHOUSES TABLE
-- ============================================

-- Add latitude and longitude columns to warehouses table
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Create index for spatial queries (useful for distance calculations)
CREATE INDEX IF NOT EXISTS idx_warehouses_coordinates ON warehouses(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add comment on columns
COMMENT ON COLUMN warehouses.latitude IS 'Warehouse latitude coordinate for Google Maps integration';
COMMENT ON COLUMN warehouses.longitude IS 'Warehouse longitude coordinate for Google Maps integration';

-- Note: Existing warehouses will have NULL coordinates
-- Warehouse owners should set these coordinates through the admin interface

