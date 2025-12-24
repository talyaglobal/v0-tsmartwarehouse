-- Add company type column to companies table
-- This distinguishes between warehouse companies and customer companies

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS type TEXT 
  CHECK (type IN ('warehouse_company', 'customer_company')) 
  DEFAULT 'customer_company';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_type ON companies(type);

-- Update existing companies to customer_company if type is null
UPDATE companies 
SET type = 'customer_company' 
WHERE type IS NULL;

-- Make type NOT NULL after setting defaults
ALTER TABLE companies 
ALTER COLUMN type SET NOT NULL;

