-- Add warehouse_id column to warehouse_services table if it doesn't exist
-- This is required for the new warehouse services structure (migration 089)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'warehouse_services' 
      AND column_name = 'warehouse_id'
  ) THEN
    -- Add warehouse_id column
    ALTER TABLE warehouse_services 
      ADD COLUMN warehouse_id UUID;
    
    -- If there are existing rows, we can't set NOT NULL immediately
    -- First, we'll allow NULL, then update existing rows if needed
    -- For now, we'll just add the column and foreign key constraint
    
    -- Add foreign key constraint
    ALTER TABLE warehouse_services
      ADD CONSTRAINT warehouse_services_warehouse_id_fkey
      FOREIGN KEY (warehouse_id) 
      REFERENCES warehouses(id) 
      ON DELETE CASCADE;
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_warehouse_services_warehouse_id 
      ON warehouse_services(warehouse_id);
    
    RAISE NOTICE 'Added warehouse_id column to warehouse_services';
  ELSE
    RAISE NOTICE 'warehouse_id column already exists in warehouse_services';
  END IF;
END $$;

