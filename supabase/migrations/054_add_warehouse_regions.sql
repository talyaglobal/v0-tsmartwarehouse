-- TSmart Warehouse Management System - Warehouse Regions
-- Add region hierarchy between floors and halls
-- Hierarchy: Floor → Region → Hall → Zone
-- Generated: December 2024

-- ============================================
-- WAREHOUSE REGIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS warehouse_regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  floor_id UUID NOT NULL REFERENCES warehouse_floors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(floor_id, name)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_regions_floor_id ON warehouse_regions(floor_id);

-- ============================================
-- UPDATE WAREHOUSE_HALLS TO INCLUDE REGION_ID
-- ============================================
-- Add region_id column to warehouse_halls (nullable initially for migration)
ALTER TABLE warehouse_halls 
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES warehouse_regions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_halls_region_id ON warehouse_halls(region_id);

-- ============================================
-- TRIGGERS
-- ============================================
-- Auto-update updated_at timestamp
CREATE TRIGGER update_warehouse_regions_updated_at BEFORE UPDATE ON warehouse_regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE warehouse_regions ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be configured separately

