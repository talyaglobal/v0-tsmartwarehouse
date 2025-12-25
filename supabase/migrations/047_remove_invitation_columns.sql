-- Remove invitation_company_id, invitation_role, and invitation_password columns
-- These are no longer needed because we set company_id directly when creating invitations

-- Drop indexes if they exist (note: index name might vary, so we'll try to drop it)
DROP INDEX IF EXISTS idx_profiles_invitation_company;

-- Remove invitation columns
ALTER TABLE profiles
DROP COLUMN IF EXISTS invitation_company_id,
DROP COLUMN IF EXISTS invitation_role,
DROP COLUMN IF EXISTS invitation_password;

