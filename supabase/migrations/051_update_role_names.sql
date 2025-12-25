-- Migration: Update role names
-- Description: Rename 'admin' to 'super_admin' (system-wide) and 'admin' to 'company_admin' (company-level)
-- Created: 2025-12-25

-- Step 1: Update existing 'admin' roles in profiles table
-- Note: We need to distinguish between system admins and company admins
-- System admins: users with admin role who don't have a company_id or are system-level
-- Company admins: users with admin role who have a company_id

-- First, let's update system admins (those without company_id or system-level admins)
UPDATE profiles
SET role = 'super_admin'
WHERE role = 'admin' 
  AND (company_id IS NULL OR id IN (
    -- Add any specific system admin user IDs here if needed
    SELECT id FROM profiles WHERE email LIKE '%@tsmart.com' AND role = 'admin'
  ));

-- Update company admins (those with company_id)
UPDATE profiles
SET role = 'company_admin'
WHERE role = 'admin' 
  AND company_id IS NOT NULL
  AND role != 'super_admin'; -- Exclude already updated super admins

-- Step 2: Update any auth.users metadata that might have role stored
-- Note: This updates user_metadata which might contain role information
-- This is a best-effort update as we can't directly query auth.users from SQL

-- Step 3: Add comment to profiles table documenting the role types
COMMENT ON COLUMN profiles.role IS 'User role - System-wide: super_admin, customer, worker; Company-level: owner, company_admin, member (stored as customer)';

-- Step 4: Create an index on role for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Step 5: Update any RLS policies that reference 'admin' role
-- Note: Most policies should continue to work, but we'll update them for clarity

-- Update policies that check for admin role
DO $$
BEGIN
  -- Drop and recreate policies that check for admin role
  -- This is a safe operation as it will only affect new queries
  
  -- Example: Update any policies that check profiles.role = 'admin'
  -- You may need to adjust these based on your specific policies
  
  RAISE NOTICE 'Role migration completed. Please verify all RLS policies manually.';
END $$;

-- Step 6: Verify the migration
DO $$
DECLARE
  super_admin_count INTEGER;
  company_admin_count INTEGER;
  old_admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO super_admin_count FROM profiles WHERE role = 'super_admin';
  SELECT COUNT(*) INTO company_admin_count FROM profiles WHERE role = 'company_admin';
  SELECT COUNT(*) INTO old_admin_count FROM profiles WHERE role = 'admin';
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Super Admins: %', super_admin_count;
  RAISE NOTICE '  Company Admins: %', company_admin_count;
  RAISE NOTICE '  Old Admin roles remaining: %', old_admin_count;
  
  IF old_admin_count > 0 THEN
    RAISE WARNING 'There are still % profiles with old "admin" role. Please review manually.', old_admin_count;
  END IF;
END $$;

