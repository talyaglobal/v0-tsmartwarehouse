-- Floor Plans Table for Warehouse Floor Plan Designer
-- This table stores the 2D/3D floor plan data for each warehouse

-- Drop existing table if it exists (be careful in production!)
DROP TABLE IF EXISTS floor_plans CASCADE;

-- Create fresh table
CREATE TABLE floor_plans (
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
  created_by UUID,
  
  -- Make warehouse_id unique (one floor plan per warehouse)
  UNIQUE(warehouse_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_floor_plans_warehouse_id ON floor_plans(warehouse_id);

-- Disable RLS for simpler access (enable later with proper policies)
ALTER TABLE floor_plans DISABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE floor_plans IS 'Stores warehouse floor plan designs with vertices, items, and wall openings';

-- Grant access to authenticated users
GRANT ALL ON floor_plans TO authenticated;
GRANT ALL ON floor_plans TO anon;
