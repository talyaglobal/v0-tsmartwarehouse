-- Remove company_members table and add invited_by to profiles
-- This migration consolidates team management into the profiles table

-- Step 1: Add invited_by column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Step 2: Add index for invited_by
CREATE INDEX IF NOT EXISTS idx_profiles_invited_by ON profiles(invited_by);

-- Step 3: Update profiles to have company_id if it doesn't exist
-- (This should already exist, but adding IF NOT EXISTS for safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
  END IF;
END $$;

-- Step 4: Migrate data from company_members to profiles
-- Update profiles with company_id and role from company_members
UPDATE profiles p
SET 
  company_id = cm.company_id,
  role = CASE 
    WHEN cm.role = 'owner' THEN 'admin'  -- Map owner to admin role
    WHEN cm.role = 'admin' THEN 'admin'
    WHEN cm.role = 'member' THEN 'customer'
    ELSE p.role
  END,
  invited_by = cm.invited_by
FROM company_members cm
WHERE p.id = cm.user_id
  AND cm.status = 'active'
  AND p.company_id IS NULL;  -- Only update if company_id is not already set

-- Step 5: Drop RLS policies on company_members (they will be dropped with the table)
-- No need to drop individually, they'll be removed with the table

-- Step 6: Drop company_members table
DROP TABLE IF EXISTS company_members CASCADE;

-- Step 7: Update RLS policies on company_invitations to use profiles instead of company_members
DROP POLICY IF EXISTS "Company admins can view invitations" ON company_invitations;
DROP POLICY IF EXISTS "Company admins can create invitations" ON company_invitations;
DROP POLICY IF EXISTS "Token holders can view invitation" ON company_invitations;

-- New policy: Company admins can view invitations (using profiles.role)
CREATE POLICY "Company admins can view invitations"
  ON company_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.company_id = company_invitations.company_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'owner')
    )
  );

-- New policy: Company admins can create invitations
CREATE POLICY "Company admins can create invitations"
  ON company_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.company_id = company_invitations.company_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'owner')
    )
  );

-- New policy: Token holders can view invitation
CREATE POLICY "Token holders can view invitation"
  ON company_invitations FOR SELECT
  USING (
    token = current_setting('app.invitation_token', true)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.company_id = company_invitations.company_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'owner')
    )
  );

-- Step 8: Update profiles role check to include 'owner'
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'customer', 'worker', 'owner'));

-- Step 9: Add index for company_id and role combination (for faster queries)
CREATE INDEX IF NOT EXISTS idx_profiles_company_role ON profiles(company_id, role) WHERE company_id IS NOT NULL;

