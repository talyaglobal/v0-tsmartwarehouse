-- Verify and fix warehouse_services table schema
-- This migration ensures all required columns exist for the new structure (migration 089)

-- Check if pricing_type column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'warehouse_services' 
      AND column_name = 'pricing_type'
  ) THEN
    -- Add pricing_type column with default value
    ALTER TABLE warehouse_services 
      ADD COLUMN pricing_type TEXT DEFAULT 'one_time';
    
    -- Update existing rows with default value
    UPDATE warehouse_services 
    SET pricing_type = 'one_time' 
    WHERE pricing_type IS NULL;
    
    -- Now add NOT NULL constraint and CHECK constraint
    ALTER TABLE warehouse_services 
      ALTER COLUMN pricing_type SET NOT NULL,
      ADD CONSTRAINT warehouse_services_pricing_type_check 
      CHECK (pricing_type IN ('one_time', 'per_pallet', 'per_sqft', 'per_day', 'per_month'));
    
    RAISE NOTICE 'Added pricing_type column to warehouse_services';
  ELSE
    RAISE NOTICE 'pricing_type column already exists in warehouse_services';
  END IF;
END $$;

-- Verify service_name column exists (migration 089 structure)
-- If 'name' column exists (from migration 053), we might need to handle both
DO $$
BEGIN
  -- Check if service_name exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'warehouse_services' 
      AND column_name = 'service_name'
  ) THEN
    -- Check if 'name' column exists (from old migration 053)
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'warehouse_services' 
        AND column_name = 'name'
    ) THEN
      -- Copy data from 'name' to 'service_name' and add new column
      ALTER TABLE warehouse_services 
        ADD COLUMN service_name TEXT;
      
      UPDATE warehouse_services 
      SET service_name = name 
      WHERE service_name IS NULL;
      
      ALTER TABLE warehouse_services 
        ALTER COLUMN service_name SET NOT NULL;
    ELSE
      -- No 'name' column, just add service_name
      ALTER TABLE warehouse_services 
        ADD COLUMN service_name TEXT NOT NULL DEFAULT '';
    END IF;
    
    RAISE NOTICE 'Added service_name column to warehouse_services';
  ELSE
    RAISE NOTICE 'service_name column already exists in warehouse_services';
  END IF;
END $$;

-- Verify service_description column exists
-- If 'description' column exists (from migration 053), copy data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'warehouse_services' 
      AND column_name = 'service_description'
  ) THEN
    -- Check if 'description' column exists (from old migration 053)
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'warehouse_services' 
        AND column_name = 'description'
    ) THEN
      -- Copy data from 'description' to 'service_description'
      ALTER TABLE warehouse_services 
        ADD COLUMN service_description TEXT;
      
      UPDATE warehouse_services 
      SET service_description = description 
      WHERE service_description IS NULL;
    ELSE
      -- No 'description' column, just add service_description
      ALTER TABLE warehouse_services 
        ADD COLUMN service_description TEXT;
    END IF;
    
    RAISE NOTICE 'Added service_description column to warehouse_services';
  ELSE
    RAISE NOTICE 'service_description column already exists in warehouse_services';
  END IF;
END $$;

-- Verify base_price column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'warehouse_services' 
      AND column_name = 'base_price'
  ) THEN
    -- Add base_price column with default value
    ALTER TABLE warehouse_services 
      ADD COLUMN base_price NUMERIC(10,2) DEFAULT 0;
    
    -- Update existing rows
    UPDATE warehouse_services 
    SET base_price = 0 
    WHERE base_price IS NULL;
    
    -- Now add NOT NULL constraint and CHECK constraint
    ALTER TABLE warehouse_services 
      ALTER COLUMN base_price SET NOT NULL,
      ADD CONSTRAINT warehouse_services_base_price_check 
      CHECK (base_price >= 0);
    
    RAISE NOTICE 'Added base_price column to warehouse_services';
  ELSE
    RAISE NOTICE 'base_price column already exists in warehouse_services';
  END IF;
END $$;

-- Verify is_active column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'warehouse_services' 
      AND column_name = 'is_active'
  ) THEN
    ALTER TABLE warehouse_services 
      ADD COLUMN is_active BOOLEAN DEFAULT true;
    
    RAISE NOTICE 'Added is_active column to warehouse_services';
  ELSE
    RAISE NOTICE 'is_active column already exists in warehouse_services';
  END IF;
END $$;

-- Verify company_service_id column exists (from migration 094)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'warehouse_services' 
      AND column_name = 'company_service_id'
  ) THEN
    ALTER TABLE warehouse_services 
      ADD COLUMN company_service_id UUID REFERENCES company_services(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_warehouse_services_company_service_id 
      ON warehouse_services(company_service_id);
    
    RAISE NOTICE 'Added company_service_id column to warehouse_services';
  ELSE
    RAISE NOTICE 'company_service_id column already exists in warehouse_services';
  END IF;
END $$;

