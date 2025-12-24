-- Add warehouse ownership to warehouses table
-- This links warehouses to their owner companies

ALTER TABLE warehouses 
ADD COLUMN IF NOT EXISTS owner_company_id UUID 
  REFERENCES companies(id) ON DELETE RESTRICT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_warehouses_owner_company_id ON warehouses(owner_company_id);

-- Note: Existing warehouses will have NULL owner_company_id
-- These should be updated manually or through the application

