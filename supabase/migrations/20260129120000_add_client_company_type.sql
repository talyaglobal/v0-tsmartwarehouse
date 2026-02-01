-- Migration: Add client_company type to companies table
-- Created: 2026-01-29
-- Purpose: Support corporate warehouse clients with their own company entities

-- Drop the existing constraint
ALTER TABLE companies 
DROP CONSTRAINT IF EXISTS companies_type_check;

-- Add new constraint that includes client_company
ALTER TABLE companies 
ADD CONSTRAINT companies_type_check 
CHECK (type IN ('warehouse_company', 'customer_company', 'client_company'));

-- Add comment for documentation
COMMENT ON COLUMN companies.type IS 'Company type: warehouse_company (warehouse owners), customer_company (legacy/warehouse owners), client_company (corporate warehouse clients)';
