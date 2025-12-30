-- Migration: Update warehouse structure for new requirements
-- Changes:
-- 1. warehouse_type: array → single value (set all to 'general-dry-ambient')
-- 2. storage_types: array → single value
-- 3. temperature_types: KEEP AS ARRAY (multi-select checkboxes) ← CRITICAL CHANGE
-- 4. Remove at_capacity_sq_ft and at_capacity_pallet columns
-- 5. Remove appointment_required from access_info

-- Step 0: Drop ALL existing constraints first (prevents check constraint violations)
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_warehouse_type_check CASCADE;
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_storage_type_check CASCADE;
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_temperature_type_check CASCADE;

-- Step 1: Add temporary columns for single-value fields
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS warehouse_type_single TEXT DEFAULT 'general-dry-ambient';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS storage_type_single TEXT DEFAULT 'rack-space';

-- Step 2: Migrate data from array to single value
UPDATE warehouses
SET warehouse_type_single = COALESCE(warehouse_type[1], 'general-dry-ambient')
WHERE warehouse_type IS NOT NULL AND array_length(warehouse_type, 1) > 0;

UPDATE warehouses
SET storage_type_single = COALESCE(storage_types[1], 'rack-space')
WHERE storage_types IS NOT NULL AND array_length(storage_types, 1) > 0;

-- Step 3: Set ALL warehouse_type to 'general-dry-ambient' as requested
UPDATE warehouses SET warehouse_type_single = 'general-dry-ambient';

-- Step 4: Handle temperature_types - CONVERT TO/KEEP AS ARRAY (multi-select)
-- Drop old single temperature_type column if exists
ALTER TABLE warehouses DROP COLUMN IF EXISTS temperature_type CASCADE;

-- Clean temperature_types: remove invalid values and normalize
UPDATE warehouses
SET temperature_types = (
  SELECT ARRAY_AGG(value ORDER BY value)
  FROM UNNEST(temperature_types) AS value
  WHERE value IN (
    'ambient-with-ac',
    'ambient-without-ac',
    'ambient-with-heater',
    'ambient-without-heater',
    'chilled',
    'frozen',
    'open-area-with-tent',
    'open-area'
  )
)
WHERE temperature_types IS NOT NULL AND array_length(temperature_types, 1) > 0;

-- Initialize with default values where NULL or empty
UPDATE warehouses
SET temperature_types = ARRAY['ambient-with-ac']::text[]
WHERE temperature_types IS NULL OR temperature_types = '{}'::text[];

-- Step 5: Drop old array columns (warehouse_type, storage_types - NOT temperature_types!)
ALTER TABLE warehouses DROP COLUMN IF EXISTS warehouse_type CASCADE;
ALTER TABLE warehouses DROP COLUMN IF EXISTS storage_types CASCADE;

-- Step 6: Rename temp columns to original names
ALTER TABLE warehouses RENAME COLUMN warehouse_type_single TO warehouse_type;
ALTER TABLE warehouses RENAME COLUMN storage_type_single TO storage_type;

-- Step 7: Set NOT NULL constraints
ALTER TABLE warehouses ALTER COLUMN warehouse_type SET NOT NULL;
ALTER TABLE warehouses ALTER COLUMN storage_type SET NOT NULL;

-- Step 8: Drop at_capacity columns
ALTER TABLE warehouses DROP COLUMN IF EXISTS at_capacity_sq_ft CASCADE;
ALTER TABLE warehouses DROP COLUMN IF EXISTS at_capacity_pallet CASCADE;

-- Step 9: Update access_info JSONB to remove appointmentRequired field
UPDATE warehouses
SET access_info = access_info - 'appointmentRequired'
WHERE access_info IS NOT NULL AND access_info ? 'appointmentRequired';

-- Step 10: Add fresh check constraints (after data migration)
ALTER TABLE warehouses ADD CONSTRAINT warehouses_warehouse_type_check
CHECK (warehouse_type IN (
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
));

ALTER TABLE warehouses ADD CONSTRAINT warehouses_storage_type_check
CHECK (storage_type IN (
  'bulk-space',
  'rack-space',
  'individual-unit',
  'lockable-unit',
  'cage',
  'open-yard',
  'closed-yard'
));

-- Temperature types as ARRAY (multi-select) - CRITICAL: MUST BE ARRAY
ALTER TABLE warehouses ADD CONSTRAINT warehouses_temperature_types_check
CHECK (
  temperature_types <@ ARRAY[
    'ambient-with-ac',
    'ambient-without-ac',
    'ambient-with-heater',
    'ambient-without-heater',
    'chilled',
    'frozen',
    'open-area-with-tent',
    'open-area'
  ]::text[]
);

-- Step 9: Ensure rent_methods is an array (keep this as is since customer can offer both)
-- No change needed for rent_methods

-- Add comments
COMMENT ON COLUMN warehouses.warehouse_type IS 'Single warehouse type (not array)';
COMMENT ON COLUMN warehouses.storage_type IS 'Single storage type (not array)';
COMMENT ON COLUMN warehouses.temperature_type IS 'Single temperature type (not array), includes heater options';
