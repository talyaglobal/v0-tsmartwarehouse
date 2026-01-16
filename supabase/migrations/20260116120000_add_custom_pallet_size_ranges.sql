-- Migration: Add min/max ranges for custom pallet sizes
-- Purpose: Support length/width ranges for custom pallet sizes while keeping backward compatibility

-- Ensure base tables exist (safety for environments missing earlier migration)
CREATE TABLE IF NOT EXISTS warehouse_custom_pallet_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_pricing_id UUID NOT NULL REFERENCES warehouse_pallet_pricing(id) ON DELETE CASCADE,
  length_cm INTEGER NOT NULL CHECK (length_cm > 0),
  width_cm INTEGER NOT NULL CHECK (width_cm > 0),
  length_min_cm INTEGER NOT NULL CHECK (length_min_cm > 0),
  length_max_cm INTEGER NOT NULL CHECK (length_max_cm >= length_min_cm),
  width_min_cm INTEGER NOT NULL CHECK (width_min_cm > 0),
  width_max_cm INTEGER NOT NULL CHECK (width_max_cm >= width_min_cm),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(pallet_pricing_id, length_min_cm, length_max_cm, width_min_cm, width_max_cm)
);

CREATE TABLE IF NOT EXISTS warehouse_custom_pallet_size_height_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_pallet_size_id UUID NOT NULL REFERENCES warehouse_custom_pallet_sizes(id) ON DELETE CASCADE,
  height_min_cm INTEGER NOT NULL CHECK (height_min_cm >= 0),
  height_max_cm INTEGER NOT NULL CHECK (height_max_cm > height_min_cm),
  price_per_unit DECIMAL(10,2) NOT NULL CHECK (price_per_unit > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status BOOLEAN DEFAULT true NOT NULL,
  UNIQUE(custom_pallet_size_id, height_min_cm, height_max_cm)
);

ALTER TABLE warehouse_custom_pallet_sizes
  ADD COLUMN IF NOT EXISTS length_min_cm INTEGER,
  ADD COLUMN IF NOT EXISTS length_max_cm INTEGER,
  ADD COLUMN IF NOT EXISTS width_min_cm INTEGER,
  ADD COLUMN IF NOT EXISTS width_max_cm INTEGER;

UPDATE warehouse_custom_pallet_sizes
SET
  length_min_cm = COALESCE(length_min_cm, length_cm),
  length_max_cm = COALESCE(length_max_cm, length_cm),
  width_min_cm = COALESCE(width_min_cm, width_cm),
  width_max_cm = COALESCE(width_max_cm, width_cm)
WHERE
  length_min_cm IS NULL
  OR length_max_cm IS NULL
  OR width_min_cm IS NULL
  OR width_max_cm IS NULL;

ALTER TABLE warehouse_custom_pallet_sizes
  ALTER COLUMN length_min_cm SET NOT NULL,
  ALTER COLUMN length_max_cm SET NOT NULL,
  ALTER COLUMN width_min_cm SET NOT NULL,
  ALTER COLUMN width_max_cm SET NOT NULL;

ALTER TABLE warehouse_custom_pallet_sizes
  ADD CONSTRAINT warehouse_custom_pallet_sizes_length_min_positive
    CHECK (length_min_cm > 0),
  ADD CONSTRAINT warehouse_custom_pallet_sizes_length_max_ge_min
    CHECK (length_max_cm >= length_min_cm),
  ADD CONSTRAINT warehouse_custom_pallet_sizes_width_min_positive
    CHECK (width_min_cm > 0),
  ADD CONSTRAINT warehouse_custom_pallet_sizes_width_max_ge_min
    CHECK (width_max_cm >= width_min_cm);

ALTER TABLE warehouse_custom_pallet_sizes
  DROP CONSTRAINT IF EXISTS warehouse_custom_pallet_sizes_pallet_pricing_id_length_cm_width_cm_key;

ALTER TABLE warehouse_custom_pallet_sizes
  ADD CONSTRAINT warehouse_custom_pallet_sizes_unique_range
    UNIQUE (pallet_pricing_id, length_min_cm, length_max_cm, width_min_cm, width_max_cm);

COMMENT ON COLUMN warehouse_custom_pallet_sizes.length_min_cm IS 'Minimum pallet length in cm (inclusive)';
COMMENT ON COLUMN warehouse_custom_pallet_sizes.length_max_cm IS 'Maximum pallet length in cm (inclusive)';
COMMENT ON COLUMN warehouse_custom_pallet_sizes.width_min_cm IS 'Minimum pallet width in cm (inclusive)';
COMMENT ON COLUMN warehouse_custom_pallet_sizes.width_max_cm IS 'Maximum pallet width in cm (inclusive)';

CREATE INDEX IF NOT EXISTS idx_warehouse_custom_pallet_sizes_pallet_pricing_id
ON warehouse_custom_pallet_sizes(pallet_pricing_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_custom_pallet_sizes_status
ON warehouse_custom_pallet_sizes(status) WHERE status = true;

CREATE INDEX IF NOT EXISTS idx_warehouse_custom_pallet_size_height_pricing_size_id
ON warehouse_custom_pallet_size_height_pricing(custom_pallet_size_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_custom_pallet_size_height_pricing_status
ON warehouse_custom_pallet_size_height_pricing(status) WHERE status = true;

ALTER TABLE warehouse_custom_pallet_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_custom_pallet_size_height_pricing ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Warehouse owners can manage custom pallet sizes'
  ) THEN
    CREATE POLICY "Warehouse owners can manage custom pallet sizes"
      ON warehouse_custom_pallet_sizes FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM warehouse_pallet_pricing wpp
          JOIN warehouses w ON w.id = wpp.warehouse_id
          WHERE wpp.id = warehouse_custom_pallet_sizes.pallet_pricing_id
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
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view custom pallet sizes'
  ) THEN
    CREATE POLICY "Anyone can view custom pallet sizes"
      ON warehouse_custom_pallet_sizes FOR SELECT
      USING (status = true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Warehouse owners can manage custom pallet size height pricing'
  ) THEN
    CREATE POLICY "Warehouse owners can manage custom pallet size height pricing"
      ON warehouse_custom_pallet_size_height_pricing FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM warehouse_custom_pallet_sizes wcps
          JOIN warehouse_pallet_pricing wpp ON wpp.id = wcps.pallet_pricing_id
          JOIN warehouses w ON w.id = wpp.warehouse_id
          WHERE wcps.id = warehouse_custom_pallet_size_height_pricing.custom_pallet_size_id
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
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view custom pallet size height pricing'
  ) THEN
    CREATE POLICY "Anyone can view custom pallet size height pricing"
      ON warehouse_custom_pallet_size_height_pricing FOR SELECT
      USING (status = true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_warehouse_custom_pallet_sizes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_warehouse_custom_pallet_size_height_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_warehouse_custom_pallet_sizes_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_warehouse_custom_pallet_sizes_updated_at
    BEFORE UPDATE ON warehouse_custom_pallet_sizes
    FOR EACH ROW
    EXECUTE FUNCTION update_warehouse_custom_pallet_sizes_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_warehouse_custom_pallet_size_height_pricing_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_warehouse_custom_pallet_size_height_pricing_updated_at
    BEFORE UPDATE ON warehouse_custom_pallet_size_height_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_warehouse_custom_pallet_size_height_pricing_updated_at();
  END IF;
END $$;
