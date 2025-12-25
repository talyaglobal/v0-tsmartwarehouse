-- Add invitation_password column back to profiles table
-- This is needed for auto-login when user clicks "Accept Invitation & Login" button
-- Password will be cleared when invitation is accepted

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS invitation_password TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN profiles.invitation_password IS 'Temporary password for invitation auto-login. Cleared when invitation is accepted.';

