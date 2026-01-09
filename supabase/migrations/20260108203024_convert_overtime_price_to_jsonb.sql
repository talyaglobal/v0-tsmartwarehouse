-- Migration: Convert overtime_price from DECIMAL to JSONB
-- Purpose: Store overtime pricing as an object with outsideWorkingHours, outsideWorkingDays, and holidays

-- Step 1: Add new JSONB column
ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS overtime_price_jsonb JSONB;

-- Step 2: Migrate existing DECIMAL values to JSONB format
-- If there's an existing value, convert it to the new format (assuming it's for outsideWorkingHours)
UPDATE warehouses
SET overtime_price_jsonb = jsonb_build_object(
  'outsideWorkingHours', overtime_price
)
WHERE overtime_price IS NOT NULL AND overtime_price_jsonb IS NULL;

-- Step 3: Set default empty object for NULL values
UPDATE warehouses
SET overtime_price_jsonb = '{}'::jsonb
WHERE overtime_price_jsonb IS NULL;

-- Step 4: Drop old DECIMAL column
ALTER TABLE warehouses DROP COLUMN IF EXISTS overtime_price;

-- Step 5: Rename new column to original name
ALTER TABLE warehouses RENAME COLUMN overtime_price_jsonb TO overtime_price;

-- Step 6: Add comment
COMMENT ON COLUMN warehouses.overtime_price IS 'JSONB object with overtime pricing: {"outsideWorkingHours": number, "outsideWorkingDays": number, "holidays": number}';

