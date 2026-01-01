-- Make code column nullable in warehouse_services table
-- The new structure (migration 089) doesn't require code, so it should be nullable
-- Old services from migration 053 will keep their codes, new services can have NULL code

ALTER TABLE warehouse_services 
  ALTER COLUMN code DROP NOT NULL;

-- Remove unique constraint on code since it can be NULL now
-- (PostgreSQL allows multiple NULLs in a unique column)
-- But we'll keep the unique constraint for non-null values
-- Actually, we need to drop and recreate the constraint to allow NULLs
DO $$
BEGIN
  -- Drop existing unique constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'warehouse_services_code_key'
  ) THEN
    ALTER TABLE warehouse_services DROP CONSTRAINT warehouse_services_code_key;
    RAISE NOTICE 'Dropped unique constraint on code column';
  END IF;
  
  -- Create partial unique index that only applies to non-null codes
  CREATE UNIQUE INDEX IF NOT EXISTS warehouse_services_code_unique 
    ON warehouse_services(code) 
    WHERE code IS NOT NULL;
  
  RAISE NOTICE 'Created partial unique index on code column (allows NULLs)';
END $$;

COMMENT ON COLUMN warehouse_services.code IS 'Optional service code (legacy field from migration 053). New services from company templates may have NULL code.';

