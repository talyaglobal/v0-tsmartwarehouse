-- Add floor_number support to floor_plans table
-- This allows multiple floors per warehouse

-- Add floor_number column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'floor_plans' AND column_name = 'floor_number') THEN
    ALTER TABLE floor_plans ADD COLUMN floor_number INTEGER DEFAULT 1;
  END IF;
END $$;

-- Drop the old unique constraint on warehouse_id only
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'floor_plans_warehouse_id_key'
  ) THEN
    ALTER TABLE floor_plans DROP CONSTRAINT floor_plans_warehouse_id_key;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- Add composite unique constraint on (warehouse_id, floor_number)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'floor_plans_warehouse_floor_unique'
  ) THEN
    ALTER TABLE floor_plans ADD CONSTRAINT floor_plans_warehouse_floor_unique UNIQUE (warehouse_id, floor_number);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create index for faster lookups by warehouse and floor
CREATE INDEX IF NOT EXISTS idx_floor_plans_warehouse_floor ON floor_plans(warehouse_id, floor_number);

-- Update existing records to have floor_number = 1 if null
UPDATE floor_plans SET floor_number = 1 WHERE floor_number IS NULL;

-- Make floor_number NOT NULL after setting defaults
ALTER TABLE floor_plans ALTER COLUMN floor_number SET NOT NULL;

COMMENT ON COLUMN floor_plans.floor_number IS 'Floor number (1 = ground floor, 2 = first floor, etc.)';
