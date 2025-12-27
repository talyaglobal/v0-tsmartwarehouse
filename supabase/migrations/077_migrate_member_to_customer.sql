-- Migrate 'member' role to 'customer' in profiles table
-- This migration updates all profiles with role = 'member' to role = 'customer'
-- Member role is now reserved for customers (users who rent warehouses, company_id = null)
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

-- Step 2: Add temporary constraint that allows both 'member' and 'customer'
-- This allows us to update existing rows without constraint violations
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check_temp
CHECK (role IN ('root', 'company_owner', 'company_admin', 'member', 'customer', 'warehouse_staff'));

-- Step 3: Update all profiles with role = 'member' to role = 'customer'
UPDATE profiles
SET role = 'customer'
WHERE role = 'member';

-- Step 4: Drop temporary constraint and add final constraint without 'member'
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check_temp;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('root', 'company_owner', 'company_admin', 'customer', 'warehouse_staff'));

-- Step 5: Update the comment on the role column
COMMENT ON COLUMN profiles.role IS 'User role: root (System Admin), company_owner (Company Owner), company_admin (Company Admin), warehouse_staff (Warehouse Staff), customer (Customer/Member - warehouse renters, company_id = null)';

-- Step 6: Verify migration
DO $$
DECLARE
  member_count INTEGER;
  customer_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO member_count FROM profiles WHERE role = 'member';
  SELECT COUNT(*) INTO customer_count FROM profiles WHERE role = 'customer';
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Profiles with role "member" (should be 0): %', member_count;
  RAISE NOTICE '  Profiles with role "customer": %', customer_count;
  
  IF member_count > 0 THEN
    RAISE WARNING 'There are still % profiles with "member" role. Please review manually.', member_count;
  END IF;
END $$;

