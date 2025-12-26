-- Add company_id to audit_logs table
-- This allows filtering audit logs by company for company admins
-- and enables root users to view all audit logs with company filtering

-- Add company_id column (nullable, will be populated from user's profile)
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);

-- Populate company_id for existing audit logs based on user's profile
UPDATE audit_logs al
SET company_id = p.company_id
FROM profiles p
WHERE al.user_id = p.id
  AND al.company_id IS NULL
  AND p.company_id IS NOT NULL;

-- Update RLS policies
-- Drop existing policy
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;

-- Policy: Root users can view all audit logs
CREATE POLICY "Root users can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'root'
    )
  );

-- Policy: Company admins can view their company's audit logs
CREATE POLICY "Company admins can view company audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('owner', 'company_admin')
      AND p.company_id = audit_logs.company_id
    )
  );

-- Policy: System can insert audit logs (via service role)
-- Note: This is handled via service role key, not RLS
-- RLS policies don't apply when using service role key

-- Add comment
COMMENT ON COLUMN audit_logs.company_id IS 'Company ID of the user who performed the action, populated from profiles.company_id';

