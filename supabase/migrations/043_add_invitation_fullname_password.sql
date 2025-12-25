-- Add fullname and password fields to company_invitations table
-- This allows storing the full name and generated password for new users

ALTER TABLE company_invitations
ADD COLUMN IF NOT EXISTS fullname TEXT,
ADD COLUMN IF NOT EXISTS password TEXT;

-- Add comment
COMMENT ON COLUMN company_invitations.fullname IS 'Full name of the invited user (for new users)';
COMMENT ON COLUMN company_invitations.password IS 'Generated password for the invited user (encrypted, for new users only)';

