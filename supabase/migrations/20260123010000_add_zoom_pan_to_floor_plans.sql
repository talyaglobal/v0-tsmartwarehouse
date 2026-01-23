-- Add zoom and pan columns to floor_plans table
ALTER TABLE floor_plans ADD COLUMN IF NOT EXISTS zoom NUMERIC DEFAULT 1;
ALTER TABLE floor_plans ADD COLUMN IF NOT EXISTS pan_x NUMERIC DEFAULT 0;
ALTER TABLE floor_plans ADD COLUMN IF NOT EXISTS pan_y NUMERIC DEFAULT 0;

-- Add comments
COMMENT ON COLUMN floor_plans.zoom IS 'Camera zoom level for 2D view';
COMMENT ON COLUMN floor_plans.pan_x IS 'Camera pan X offset for 2D view';
COMMENT ON COLUMN floor_plans.pan_y IS 'Camera pan Y offset for 2D view';
