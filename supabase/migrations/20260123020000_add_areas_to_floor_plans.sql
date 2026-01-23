-- Add areas column to floor_plans table
ALTER TABLE floor_plans ADD COLUMN IF NOT EXISTS areas JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN floor_plans.areas IS 'Array of floor areas/sections with their properties';

-- Add index for areas queries
CREATE INDEX IF NOT EXISTS idx_floor_plans_areas ON floor_plans USING GIN (areas);
