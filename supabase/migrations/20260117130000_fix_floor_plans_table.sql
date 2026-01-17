-- Fix floor_plans table structure
-- This ensures the table has all required columns

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS floor_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id UUID NOT NULL,
  name VARCHAR(255) DEFAULT 'Floor Plan',
  vertices JSONB NOT NULL DEFAULT '[]',
  items JSONB NOT NULL DEFAULT '[]',
  wall_openings JSONB DEFAULT '[]',
  wall_height INTEGER DEFAULT 20,
  settings JSONB DEFAULT '{}',
  total_area NUMERIC(12, 2) DEFAULT 0,
  equipment_area NUMERIC(12, 2) DEFAULT 0,
  pallet_capacity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Add missing columns if they don't exist
DO $$ 
BEGIN
  -- Add wall_openings if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'floor_plans' AND column_name = 'wall_openings') THEN
    ALTER TABLE floor_plans ADD COLUMN wall_openings JSONB DEFAULT '[]';
  END IF;
  
  -- Add wall_height if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'floor_plans' AND column_name = 'wall_height') THEN
    ALTER TABLE floor_plans ADD COLUMN wall_height INTEGER DEFAULT 20;
  END IF;
  
  -- Add total_area if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'floor_plans' AND column_name = 'total_area') THEN
    ALTER TABLE floor_plans ADD COLUMN total_area NUMERIC(12, 2) DEFAULT 0;
  END IF;
  
  -- Add equipment_area if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'floor_plans' AND column_name = 'equipment_area') THEN
    ALTER TABLE floor_plans ADD COLUMN equipment_area NUMERIC(12, 2) DEFAULT 0;
  END IF;
  
  -- Add pallet_capacity if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'floor_plans' AND column_name = 'pallet_capacity') THEN
    ALTER TABLE floor_plans ADD COLUMN pallet_capacity INTEGER DEFAULT 0;
  END IF;
  
  -- Add settings if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'floor_plans' AND column_name = 'settings') THEN
    ALTER TABLE floor_plans ADD COLUMN settings JSONB DEFAULT '{}';
  END IF;
END $$;

-- Create unique constraint on warehouse_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'floor_plans_warehouse_id_key'
  ) THEN
    ALTER TABLE floor_plans ADD CONSTRAINT floor_plans_warehouse_id_key UNIQUE (warehouse_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_floor_plans_warehouse_id ON floor_plans(warehouse_id);

-- Disable RLS for simpler access
ALTER TABLE floor_plans DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON floor_plans TO authenticated;
GRANT ALL ON floor_plans TO anon;
