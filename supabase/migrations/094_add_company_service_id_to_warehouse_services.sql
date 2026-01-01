-- Add company_service_id to warehouse_services table
-- This allows warehouse services to be linked to company service templates
-- If company_service_id is NULL, the service is warehouse-specific (not from a template)
ALTER TABLE warehouse_services 
  ADD COLUMN IF NOT EXISTS company_service_id UUID REFERENCES company_services(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_warehouse_services_company_service_id ON warehouse_services(company_service_id);

-- Add comment
COMMENT ON COLUMN warehouse_services.company_service_id IS 'Reference to company service template if this service was mapped from a template. NULL means warehouse-specific service.';

