-- Remove company_invitations table
-- Invitation information will be stored in profiles table instead

-- Step 1: Add invitation fields to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS invitation_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invitation_company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS invitation_role TEXT CHECK (invitation_role IN ('owner', 'admin', 'member')),
ADD COLUMN IF NOT EXISTS invitation_password TEXT; -- Store generated password for new users

-- Step 2: Create indexes for invitation fields
CREATE INDEX IF NOT EXISTS idx_profiles_invitation_token ON profiles(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_invitation_company ON profiles(invitation_company_id) WHERE invitation_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_invitation_expires ON profiles(invitation_expires_at) WHERE invitation_expires_at IS NOT NULL;

-- Step 3: Migrate pending invitations from company_invitations to profiles
-- This will update existing profiles with invitation data
DO $$
DECLARE
  inv_record RECORD;
  profile_id UUID;
BEGIN
  FOR inv_record IN 
    SELECT * FROM company_invitations 
    WHERE accepted_at IS NULL 
    AND expires_at > NOW()
  LOOP
    -- Find or create profile for this email
    SELECT id INTO profile_id
    FROM profiles
    WHERE email = inv_record.email
    LIMIT 1;
    
    -- If profile exists, update it with invitation data
    IF profile_id IS NOT NULL THEN
      UPDATE profiles
      SET 
        invitation_token = inv_record.token,
        invitation_expires_at = inv_record.expires_at,
        invitation_company_id = inv_record.company_id,
        invitation_role = inv_record.role,
        invitation_password = inv_record.password
      WHERE id = profile_id;
    END IF;
  END LOOP;
END $$;

-- Step 4: Drop RLS policies for company_invitations
DROP POLICY IF EXISTS "Company admins can view invitations" ON company_invitations;
DROP POLICY IF EXISTS "Company admins can create invitations" ON company_invitations;
DROP POLICY IF EXISTS "Token holders can view invitation" ON company_invitations;
DROP POLICY IF EXISTS "Admins can manage all invitations" ON company_invitations;

-- Step 5: Drop company_invitations table
DROP TABLE IF EXISTS company_invitations CASCADE;

