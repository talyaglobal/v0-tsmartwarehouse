-- Migrate 'owner' role to 'company_owner' in profiles table
-- This migration updates all profiles with role = 'owner' to role = 'company_owner'
-- Created: 2025-01-XX

-- Step 1: Drop existing constraint (handle both named and inline constraints)
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- Find all CHECK constraints on profiles.role
  FOR constraint_record IN
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    -- Drop the constraint
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;
END $$;

-- Step 2: Add temporary constraint that allows both 'owner' and 'company_owner'
-- This allows us to update existing rows without constraint violations
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check_temp
CHECK (role IN ('root', 'company_admin', 'member', 'warehouse_staff', 'owner', 'company_owner'));

-- Step 3: Update all profiles with role = 'owner' to role = 'company_owner'
UPDATE profiles
SET role = 'company_owner'
WHERE role = 'owner';

-- Step 4: Drop temporary constraint and add final constraint without 'owner'
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check_temp;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('root', 'company_admin', 'member', 'warehouse_staff', 'company_owner'));

-- Step 5: Update RLS policies that reference 'owner' role
-- Update audit logs policy (drop and recreate with correct name)
DROP POLICY IF EXISTS "Company admins can view company audit logs" ON audit_logs;
CREATE POLICY "Company admins can view company audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('company_owner', 'company_admin')
    AND p.company_id = audit_logs.company_id
  )
);

-- Step 6: Update the comment on the role column
COMMENT ON COLUMN profiles.role IS 'User role: root (System Admin), company_owner (Company Owner), company_admin (Company Admin), member (Customer/Member), warehouse_staff (Warehouse Staff)';

-- Step 7: Verify migration
DO $$
DECLARE
  owner_count INTEGER;
  company_owner_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO owner_count FROM profiles WHERE role = 'owner';
  SELECT COUNT(*) INTO company_owner_count FROM profiles WHERE role = 'company_owner';
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Profiles with role "owner" (should be 0): %', owner_count;
  RAISE NOTICE '  Profiles with role "company_owner": %', company_owner_count;
  
  IF owner_count > 0 THEN
    RAISE WARNING 'There are still % profiles with "owner" role. Please review manually.', owner_count;
  END IF;
END $$;

