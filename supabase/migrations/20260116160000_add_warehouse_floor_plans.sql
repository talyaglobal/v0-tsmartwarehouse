-- Floor plan tables for warehouse layout planner

CREATE TABLE IF NOT EXISTS warehouse_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  floor_level INTEGER NOT NULL DEFAULT 1,
  length_m NUMERIC(10,2) NOT NULL CHECK (length_m > 0),
  width_m NUMERIC(10,2) NOT NULL CHECK (width_m > 0),
  height_m NUMERIC(10,2) NOT NULL CHECK (height_m > 0),
  wall_clearance_m NUMERIC(10,2) NOT NULL DEFAULT 0.5 CHECK (wall_clearance_m >= 0),
  sprinkler_clearance_m NUMERIC(10,2) NOT NULL DEFAULT 0.9 CHECK (sprinkler_clearance_m >= 0),
  safety_clearance_m NUMERIC(10,2) NOT NULL DEFAULT 0.5 CHECK (safety_clearance_m >= 0),
  main_aisle_m NUMERIC(10,2) NOT NULL DEFAULT 3.5 CHECK (main_aisle_m >= 0),
  side_aisle_m NUMERIC(10,2) NOT NULL DEFAULT 2.5 CHECK (side_aisle_m >= 0),
  pedestrian_aisle_m NUMERIC(10,2) NOT NULL DEFAULT 1.0 CHECK (pedestrian_aisle_m >= 0),
  loading_zone_depth_m NUMERIC(10,2) NOT NULL DEFAULT 3.0 CHECK (loading_zone_depth_m >= 0),
  dock_zone_depth_m NUMERIC(10,2) NOT NULL DEFAULT 4.5 CHECK (dock_zone_depth_m >= 0),
  standard_pallet_height_m NUMERIC(10,2) NOT NULL DEFAULT 1.5 CHECK (standard_pallet_height_m > 0),
  euro_pallet_height_m NUMERIC(10,2) NOT NULL DEFAULT 1.5 CHECK (euro_pallet_height_m > 0),
  custom_pallet_length_cm INTEGER NOT NULL DEFAULT 100 CHECK (custom_pallet_length_cm > 0),
  custom_pallet_width_cm INTEGER NOT NULL DEFAULT 100 CHECK (custom_pallet_width_cm > 0),
  custom_pallet_height_cm INTEGER NOT NULL DEFAULT 150 CHECK (custom_pallet_height_cm > 0),
  stacking_override INTEGER NULL CHECK (stacking_override IS NULL OR stacking_override > 0),
  status BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_floor_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES warehouse_floors(id) ON DELETE CASCADE,
  zone_type TEXT NOT NULL,
  x_m NUMERIC(10,2) NOT NULL CHECK (x_m >= 0),
  y_m NUMERIC(10,2) NOT NULL CHECK (y_m >= 0),
  width_m NUMERIC(10,2) NOT NULL CHECK (width_m > 0),
  height_m NUMERIC(10,2) NOT NULL CHECK (height_m > 0),
  rotation_deg NUMERIC(10,2) NOT NULL DEFAULT 0,
  status BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_floor_aisle_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES warehouse_floors(id) ON DELETE CASCADE,
  aisle_type TEXT NOT NULL,
  width_m NUMERIC(10,2) NOT NULL CHECK (width_m > 0),
  status BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_floor_pallet_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES warehouse_floors(id) ON DELETE CASCADE,
  pallet_type TEXT NOT NULL,
  custom_length_cm INTEGER NULL,
  custom_width_cm INTEGER NULL,
  custom_height_cm INTEGER NULL,
  position_x_m NUMERIC(10,2) NOT NULL CHECK (position_x_m >= 0),
  position_y_m NUMERIC(10,2) NOT NULL CHECK (position_y_m >= 0),
  rotation_deg NUMERIC(10,2) NOT NULL DEFAULT 0,
  stack_count INTEGER NOT NULL DEFAULT 1 CHECK (stack_count > 0),
  status BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_floor_planner_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL UNIQUE REFERENCES warehouses(id) ON DELETE CASCADE,
  custom_min_length_cm INTEGER NOT NULL DEFAULT 80 CHECK (custom_min_length_cm > 0),
  custom_min_width_cm INTEGER NOT NULL DEFAULT 80 CHECK (custom_min_width_cm > 0),
  custom_min_height_cm INTEGER NOT NULL DEFAULT 10 CHECK (custom_min_height_cm > 0),
  custom_max_length_cm INTEGER NOT NULL DEFAULT 120 CHECK (custom_max_length_cm > 0),
  custom_max_width_cm INTEGER NOT NULL DEFAULT 120 CHECK (custom_max_width_cm > 0),
  custom_max_height_cm INTEGER NOT NULL DEFAULT 200 CHECK (custom_max_height_cm > 0),
  status BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_floors_warehouse_id ON warehouse_floors(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_floor_zones_floor_id ON warehouse_floor_zones(floor_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_floor_aisle_defs_floor_id ON warehouse_floor_aisle_defs(floor_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_floor_pallet_layouts_floor_id ON warehouse_floor_pallet_layouts(floor_id);

ALTER TABLE warehouse_floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_floor_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_floor_aisle_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_floor_pallet_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_floor_planner_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Warehouse owners can manage floors'
  ) THEN
    CREATE POLICY "Warehouse owners can manage floors"
      ON warehouse_floors FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM warehouses w
          WHERE w.id = warehouse_floors.warehouse_id
          AND w.owner_company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
          )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Warehouse owners can manage floor zones'
  ) THEN
    CREATE POLICY "Warehouse owners can manage floor zones"
      ON warehouse_floor_zones FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM warehouse_floors wf
          JOIN warehouses w ON w.id = wf.warehouse_id
          WHERE wf.id = warehouse_floor_zones.floor_id
          AND w.owner_company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
          )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Warehouse owners can manage aisle defs'
  ) THEN
    CREATE POLICY "Warehouse owners can manage aisle defs"
      ON warehouse_floor_aisle_defs FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM warehouse_floors wf
          JOIN warehouses w ON w.id = wf.warehouse_id
          WHERE wf.id = warehouse_floor_aisle_defs.floor_id
          AND w.owner_company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
          )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Warehouse owners can manage pallet layouts'
  ) THEN
    CREATE POLICY "Warehouse owners can manage pallet layouts"
      ON warehouse_floor_pallet_layouts FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM warehouse_floors wf
          JOIN warehouses w ON w.id = wf.warehouse_id
          WHERE wf.id = warehouse_floor_pallet_layouts.floor_id
          AND w.owner_company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
          )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Warehouse owners can manage planner settings'
  ) THEN
    CREATE POLICY "Warehouse owners can manage planner settings"
      ON warehouse_floor_planner_settings FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM warehouses w
          WHERE w.id = warehouse_floor_planner_settings.warehouse_id
          AND w.owner_company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
          )
        )
      );
  END IF;
END $$;
