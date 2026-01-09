-- Migration 113: Enhance Warehouse Schema
-- Created: 2025-01-XX
-- Purpose: Add multi-select warehouse/storage types, videos, time slots, overtime pricing, and gated access

-- =====================================================
-- PART 1: CONVERT warehouse_type TO ARRAY (multi-select)
-- =====================================================

-- Step 1: Add temporary array column
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS warehouse_type_array TEXT[];

-- Step 2: Migrate existing single value to array
UPDATE warehouses
SET warehouse_type_array = ARRAY[warehouse_type]::text[]
WHERE warehouse_type IS NOT NULL AND warehouse_type != '';

-- Step 3: Set default for NULL values
UPDATE warehouses
SET warehouse_type_array = ARRAY['general-dry-ambient']::text[]
WHERE warehouse_type_array IS NULL;

-- Step 4: Drop old constraint and column
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_warehouse_type_check CASCADE;
ALTER TABLE warehouses DROP COLUMN IF EXISTS warehouse_type CASCADE;

-- Step 5: Rename array column
ALTER TABLE warehouses RENAME COLUMN warehouse_type_array TO warehouse_type;

-- Step 6: Add array constraint
ALTER TABLE warehouses ADD CONSTRAINT warehouses_warehouse_type_check
CHECK (
  warehouse_type <@ ARRAY[
    'general-dry-ambient',
    'food-beverage-fda',
    'pharmaceutical-fda-cgmp',
    'medical-devices-fda',
    'nutraceuticals-supplements-fda',
    'cosmetics-fda',
    'hazardous-materials-hazmat',
    'cold-storage',
    'alcohol-tobacco-ttb',
    'consumer-electronics',
    'automotive-parts',
    'ecommerce-high-velocity'
  ]::text[]
);

-- Step 7: Create GIN index for array searches
CREATE INDEX IF NOT EXISTS idx_warehouses_warehouse_type_gin 
ON warehouses USING GIN(warehouse_type);

-- =====================================================
-- PART 2: CONVERT storage_type TO ARRAY (multi-select)
-- =====================================================

-- Step 1: Add temporary array column
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS storage_type_array TEXT[];

-- Step 2: Migrate existing single value to array
UPDATE warehouses
SET storage_type_array = ARRAY[storage_type]::text[]
WHERE storage_type IS NOT NULL AND storage_type != '';

-- Step 3: Set default for NULL values
UPDATE warehouses
SET storage_type_array = ARRAY['rack-space']::text[]
WHERE storage_type_array IS NULL;

-- Step 4: Drop old constraint and column
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_storage_type_check CASCADE;
ALTER TABLE warehouses DROP COLUMN IF EXISTS storage_type CASCADE;

-- Step 5: Rename array column
ALTER TABLE warehouses RENAME COLUMN storage_type_array TO storage_type;

-- Step 6: Add array constraint
ALTER TABLE warehouses ADD CONSTRAINT warehouses_storage_type_check
CHECK (
  storage_type <@ ARRAY[
    'bulk-space',
    'rack-space',
    'individual-unit',
    'lockable-unit',
    'cage',
    'open-yard',
    'closed-yard'
  ]::text[]
);

-- Step 7: Create GIN index for array searches
CREATE INDEX IF NOT EXISTS idx_warehouses_storage_type_gin 
ON warehouses USING GIN(storage_type);

-- =====================================================
-- PART 3: CONVERT video_url TO videos ARRAY
-- =====================================================

-- Step 1: Add videos array column
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS videos TEXT[];

-- Step 2: Migrate existing single video_url to array
UPDATE warehouses
SET videos = ARRAY[video_url]::text[]
WHERE video_url IS NOT NULL AND video_url != '';

-- Step 3: Drop old video_url column
ALTER TABLE warehouses DROP COLUMN IF EXISTS video_url;

-- =====================================================
-- PART 4: UPDATE access_info - REMOVE restricted, ADD gated
-- =====================================================

-- Update access_info JSONB to replace 'restricted' with 'gated' in accessType field
UPDATE warehouses
SET access_info = jsonb_set(
  access_info,
  '{accessType}',
  '"gated"'
)
WHERE access_info->>'accessType' = 'restricted';

-- =====================================================
-- PART 5: CONVERT TIME FIELDS TO TIME SLOTS ARRAYS
-- =====================================================

-- Step 1: Add time slots JSONB columns
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS product_acceptance_time_slots JSONB DEFAULT '[]'::jsonb;

ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS product_departure_time_slots JSONB DEFAULT '[]'::jsonb;

-- Step 2: Migrate existing single time fields to time slots
UPDATE warehouses
SET product_acceptance_time_slots = jsonb_build_array(
  jsonb_build_object(
    'start', COALESCE(product_acceptance_start_time::text, '08:00'),
    'end', COALESCE(product_acceptance_end_time::text, '18:00')
  )
)
WHERE (product_acceptance_start_time IS NOT NULL OR product_acceptance_end_time IS NOT NULL)
  AND (product_acceptance_time_slots IS NULL OR product_acceptance_time_slots = '[]'::jsonb);

-- Step 3: Set default time slots if both are NULL
UPDATE warehouses
SET product_acceptance_time_slots = jsonb_build_array(
  jsonb_build_object('start', '08:00', 'end', '18:00')
)
WHERE product_acceptance_time_slots IS NULL OR product_acceptance_time_slots = '[]'::jsonb;

-- Step 4: Initialize departure time slots with same as acceptance (if not set)
UPDATE warehouses
SET product_departure_time_slots = product_acceptance_time_slots
WHERE (product_departure_time_slots IS NULL OR product_departure_time_slots = '[]'::jsonb)
  AND product_acceptance_time_slots IS NOT NULL;

-- Step 5: Drop old single time columns
ALTER TABLE warehouses DROP COLUMN IF EXISTS product_acceptance_start_time;
ALTER TABLE warehouses DROP COLUMN IF EXISTS product_acceptance_end_time;

-- =====================================================
-- PART 6: ADD OVERTIME PRICING
-- =====================================================

ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS overtime_price DECIMAL(10,2);

-- =====================================================
-- PART 7: ADD COMMENTS
-- =====================================================

COMMENT ON COLUMN warehouses.warehouse_type IS 'Array of warehouse types (multi-select)';
COMMENT ON COLUMN warehouses.storage_type IS 'Array of storage types (multi-select)';
COMMENT ON COLUMN warehouses.videos IS 'Array of video URLs/paths (optional)';
COMMENT ON COLUMN warehouses.product_acceptance_time_slots IS 'Array of time slots for product acceptance: [{"start": "08:00", "end": "12:00"}, {"start": "12:00", "end": "16:00"}]';
COMMENT ON COLUMN warehouses.product_departure_time_slots IS 'Array of time slots for product departure: [{"start": "08:00", "end": "12:00"}, {"start": "12:00", "end": "16:00"}]';
COMMENT ON COLUMN warehouses.overtime_price IS 'Price per hour for overtime (outside working hours)';

