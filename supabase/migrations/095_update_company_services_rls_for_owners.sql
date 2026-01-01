-- Update RLS policies for company_services to allow company_owner role
-- This migration updates existing policies to include company_owner alongside company_admin

-- Drop existing policies
DROP POLICY IF EXISTS "Company admins can insert their company services" ON company_services;
DROP POLICY IF EXISTS "Company admins can update their company services" ON company_services;
DROP POLICY IF EXISTS "Company admins can delete their company services" ON company_services;

-- Recreate policies with company_owner role included

-- Company admins and owners can insert services for their company
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

