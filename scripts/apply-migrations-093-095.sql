-- ============================================
-- MIGRATION 093: Create company_services table
-- ============================================
-- Create company_services table for company-level service templates
-- Each company can create service templates that can be mapped to their warehouses
CREATE TABLE IF NOT EXISTS company_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_description TEXT,
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('one_time', 'per_pallet', 'per_sqft', 'per_day', 'per_month')),
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_company_services_company_id ON company_services(company_id);
CREATE INDEX IF NOT EXISTS idx_company_services_active ON company_services(company_id, is_active);

-- Enable RLS
ALTER TABLE company_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Company members can view their company's services
DROP POLICY IF EXISTS "Company members can view their company services" ON company_services;
CREATE POLICY "Company members can view their company services"
  ON company_services
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.company_id = company_services.company_id
        AND p.id = auth.uid()
        AND p.status = true
    )
  );

-- Company admins and owners can insert services for their company
DROP POLICY IF EXISTS "Company admins can insert their company services" ON company_services;
CREATE POLICY "Company admins can insert their company services"
  ON company_services
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.company_id = company_services.company_id
        AND p.id = auth.uid()
        AND p.status = true
        AND (p.role = 'root' OR p.role = 'company_admin' OR p.role = 'company_owner')
    )
  );

-- Company admins and owners can update their company's services
DROP POLICY IF EXISTS "Company admins can update their company services" ON company_services;
CREATE POLICY "Company admins can update their company services"
  ON company_services
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.company_id = company_services.company_id
        AND p.id = auth.uid()
        AND p.status = true
        AND (p.role = 'root' OR p.role = 'company_admin' OR p.role = 'company_owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.company_id = company_services.company_id
        AND p.id = auth.uid()
        AND p.status = true
        AND (p.role = 'root' OR p.role = 'company_admin' OR p.role = 'company_owner')
    )
  );

-- Company admins and owners can delete their company's services
DROP POLICY IF EXISTS "Company admins can delete their company services" ON company_services;
CREATE POLICY "Company admins can delete their company services"
  ON company_services
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.company_id = company_services.company_id
        AND p.id = auth.uid()
        AND p.status = true
        AND (p.role = 'root' OR p.role = 'company_admin' OR p.role = 'company_owner')
    )
  );

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_company_services_updated_at ON company_services;
CREATE TRIGGER update_company_services_updated_at
  BEFORE UPDATE ON company_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE company_services IS 'Company-level service templates that can be mapped to warehouses';
COMMENT ON COLUMN company_services.pricing_type IS 'How the service is priced: one_time, per_pallet, per_sqft, per_day, per_month';
COMMENT ON COLUMN company_services.base_price IS 'Default base price for the service (can be overridden when mapped to warehouse)';
COMMENT ON COLUMN company_services.is_active IS 'Whether the service template is currently active';

-- ============================================
-- MIGRATION 094: Add company_service_id to warehouse_services
-- ============================================
-- Add company_service_id to warehouse_services table
-- This allows warehouse services to be linked to company service templates
-- If company_service_id is NULL, the service is warehouse-specific (not from a template)
ALTER TABLE warehouse_services 
  ADD COLUMN IF NOT EXISTS company_service_id UUID REFERENCES company_services(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_warehouse_services_company_service_id ON warehouse_services(company_service_id);

-- Add comment
COMMENT ON COLUMN warehouse_services.company_service_id IS 'Reference to company service template if this service was mapped from a template. NULL means warehouse-specific service.';

-- ============================================
-- MIGRATION 095: Update RLS policies for company_owner role
-- ============================================
-- Note: Policies are already updated in migration 093 above to include company_owner
-- This migration is kept for consistency and in case policies need to be recreated
-- No additional changes needed as 093 already includes company_owner role
