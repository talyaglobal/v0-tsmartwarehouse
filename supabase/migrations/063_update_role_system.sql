-- Migration: Update Role System
-- Description: Update role system to support Root, Company Admin, Member, and Warehouse Staff
-- Created: 2025-01-XX

-- Step 1: Add is_system column to companies table if it doesn't exist
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Create index for system company lookup
CREATE INDEX IF NOT EXISTS idx_companies_is_system ON companies(is_system) WHERE is_system = true;

-- Step 2: Create System Company
-- This is a special company for Root users
DO $$
DECLARE
  system_company_id UUID;
BEGIN
  -- Check if system company already exists
  SELECT id INTO system_company_id
  FROM companies
  WHERE is_system = true
  LIMIT 1;

  -- Create system company if it doesn't exist
  IF system_company_id IS NULL THEN
    INSERT INTO companies (name, is_system)
    VALUES ('System', true)
    RETURNING id INTO system_company_id;
    
    RAISE NOTICE 'System company created with ID: %', system_company_id;
  ELSE
    RAISE NOTICE 'System company already exists with ID: %', system_company_id;
  END IF;
END $$;

-- Step 3: Drop ALL existing CHECK constraints on role column FIRST
-- We need to drop them before updating data
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- Find all CHECK constraints on profiles table that involve role
  FOR constraint_record IN
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
      AND contype = 'c'
  LOOP
    -- Check if this constraint involves role column
    IF constraint_record.def LIKE '%role%' THEN
      EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
      RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
    END IF;
  END LOOP;
END $$;

-- Step 4: Update existing roles to new role system
-- super_admin → root
UPDATE profiles
SET role = 'root'
WHERE role = 'super_admin';

-- customer → member
UPDATE profiles
SET role = 'member'
WHERE role = 'customer';

-- worker → warehouse_staff
UPDATE profiles
SET role = 'warehouse_staff'
WHERE role = 'worker';

-- company_admin stays as is
-- owner stays as is

-- Step 5: Assign Root users to System Company
DO $$
DECLARE
  system_company_id UUID;
  root_count INTEGER;
BEGIN
  -- Get system company ID
  SELECT id INTO system_company_id
  FROM companies
  WHERE is_system = true
  LIMIT 1;

  IF system_company_id IS NOT NULL THEN
    -- Update root users to have system company_id
    UPDATE profiles
    SET company_id = system_company_id
    WHERE role = 'root' AND (company_id IS NULL OR company_id != system_company_id);

    SELECT COUNT(*) INTO root_count FROM profiles WHERE role = 'root';
    RAISE NOTICE 'Updated % root users to system company', root_count;
  ELSE
    RAISE WARNING 'System company not found. Root users may not have company_id set.';
  END IF;
END $$;

-- Step 6: Add new CHECK constraint with updated roles
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('root', 'company_admin', 'member', 'warehouse_staff', 'owner'));

-- Note: 'owner' is kept for backward compatibility but should be migrated to 'company_admin'

-- Step 7: Update default role for new users (if column default exists)
ALTER TABLE profiles
ALTER COLUMN role SET DEFAULT 'member';

-- Step 8: Update comment on role column (if column exists)
COMMENT ON COLUMN profiles.role IS 'User role: root (System Admin), company_admin (Company Admin), member (Customer/Member), warehouse_staff (Warehouse Staff), owner (legacy - use company_admin)';

-- Step 9: Verify migration
DO $$
DECLARE
  root_count INTEGER;
  company_admin_count INTEGER;
  member_count INTEGER;
  warehouse_staff_count INTEGER;
  owner_count INTEGER;
  old_roles_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO root_count FROM profiles WHERE role = 'root';
  SELECT COUNT(*) INTO company_admin_count FROM profiles WHERE role = 'company_admin';
  SELECT COUNT(*) INTO member_count FROM profiles WHERE role = 'member';
  SELECT COUNT(*) INTO warehouse_staff_count FROM profiles WHERE role = 'warehouse_staff';
  SELECT COUNT(*) INTO owner_count FROM profiles WHERE role = 'owner';
  SELECT COUNT(*) INTO old_roles_count 
  FROM profiles 
  WHERE role IN ('super_admin', 'customer', 'worker', 'admin');
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Root users: %', root_count;
  RAISE NOTICE '  Company Admin users: %', company_admin_count;
  RAISE NOTICE '  Member users: %', member_count;
  RAISE NOTICE '  Warehouse Staff users: %', warehouse_staff_count;
  RAISE NOTICE '  Owner users (legacy): %', owner_count;
  
  IF old_roles_count > 0 THEN
    RAISE WARNING 'There are still % profiles with old roles. Please review manually.', old_roles_count;
  END IF;
END $$;

