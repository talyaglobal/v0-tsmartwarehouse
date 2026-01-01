-- Make old columns nullable in warehouse_services table
-- The new structure (migration 089) uses service_name, pricing_type, etc.
-- Old columns (name, category, unit_type) from migration 053 should be nullable
-- to allow new services from company templates

-- Make name nullable (new structure uses service_name)
ALTER TABLE warehouse_services 
  ALTER COLUMN name DROP NOT NULL;

-- Make category nullable (new structure doesn't use category)
ALTER TABLE warehouse_services 
  ALTER COLUMN category DROP NOT NULL;

-- Make unit_type nullable (new structure uses pricing_type instead)
ALTER TABLE warehouse_services 
  ALTER COLUMN unit_type DROP NOT NULL;

-- Add comments
COMMENT ON COLUMN warehouse_services.name IS 'Legacy service name (from migration 053). New services use service_name.';
COMMENT ON COLUMN warehouse_services.category IS 'Legacy service category (from migration 053). New services from company templates may have NULL category.';
COMMENT ON COLUMN warehouse_services.unit_type IS 'Legacy unit type (from migration 053). New services use pricing_type instead.';

