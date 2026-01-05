-- Migrate 'company_owner' role to 'warehouse_owner' in profiles table
-- This migration updates all profiles with role = 'company_owner' to role = 'warehouse_owner'
-- Created: 2026-01-XX

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

-- Step 2: Add temporary constraint that allows both 'company_owner' and 'warehouse_owner'
-- This allows us to update existing rows without constraint violations
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check_temp
CHECK (role IN ('root', 'company_admin', 'customer', 'warehouse_staff', 'company_owner', 'warehouse_owner'));

-- Step 3: Update all profiles with role = 'company_owner' to role = 'warehouse_owner'
UPDATE profiles
SET role = 'warehouse_owner'
WHERE role = 'company_owner';

-- Step 4: Update company_members table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_members') THEN
    -- Update company_members role column if it has company_owner
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'company_members' AND column_name = 'role'
    ) THEN
      UPDATE company_members
      SET role = 'warehouse_owner'
      WHERE role = 'company_owner';
    END IF;
  END IF;
END $$;

-- Step 5: Drop temporary constraint and add final constraint without 'company_owner'
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check_temp;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('root', 'company_admin', 'customer', 'warehouse_staff', 'warehouse_owner'));

-- Step 6: Update RLS policies that reference 'company_owner' role
-- Update audit logs policy
DROP POLICY IF EXISTS "Company admins can view company audit logs" ON audit_logs;
CREATE POLICY "Company admins can view company audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('warehouse_owner', 'company_admin')
    AND p.company_id = audit_logs.company_id
  )
);

-- Update company_services policies
DO $$
BEGIN
  -- Drop and recreate company_services policies
  DROP POLICY IF EXISTS "Company admins can view company services" ON company_services;
  DROP POLICY IF EXISTS "Company admins can create company services" ON company_services;
  DROP POLICY IF EXISTS "Company admins can update company services" ON company_services;
  DROP POLICY IF EXISTS "Company admins can delete company services" ON company_services;
  
  CREATE POLICY "Company admins can view company services"
  ON company_services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'company_admin' OR p.role = 'warehouse_owner')
      AND p.company_id = company_services.company_id
    )
  );
  
  CREATE POLICY "Company admins can create company services"
  ON company_services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'company_admin' OR p.role = 'warehouse_owner')
      AND p.company_id = company_services.company_id
    )
  );
  
  CREATE POLICY "Company admins can update company services"
  ON company_services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'company_admin' OR p.role = 'warehouse_owner')
      AND p.company_id = company_services.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'company_admin' OR p.role = 'warehouse_owner')
      AND p.company_id = company_services.company_id
    )
  );
  
  CREATE POLICY "Company admins can delete company services"
  ON company_services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'company_admin' OR p.role = 'warehouse_owner')
      AND p.company_id = company_services.company_id
    )
  );
END $$;

-- Update warehouse_reviews policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Company admins can view company reviews" ON warehouse_reviews;
  CREATE POLICY "Company admins can view company reviews"
  ON warehouse_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.owner_company_id = p.company_id
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'company_admin' OR p.role = 'warehouse_owner')
      AND w.id = warehouse_reviews.warehouse_id
    )
  );
END $$;

-- Update conversations policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Company admins can view company conversations" ON conversations;
  CREATE POLICY "Company admins can view company conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.owner_company_id = p.company_id
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'company_admin' OR p.role = 'warehouse_owner')
      AND w.id = conversations.warehouse_id
    )
  );
END $$;

-- Step 7: Update the comment on the role column
COMMENT ON COLUMN profiles.role IS 'User role: root (System Admin), warehouse_owner (Warehouse Owner), company_admin (Company Admin), customer (Customer/Member), warehouse_staff (Warehouse Staff)';

-- Step 8: Verify migration
DO $$
DECLARE
  company_owner_count INTEGER;
  warehouse_owner_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO company_owner_count FROM profiles WHERE role = 'company_owner';
  SELECT COUNT(*) INTO warehouse_owner_count FROM profiles WHERE role = 'warehouse_owner';
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Profiles with role "company_owner" (should be 0): %', company_owner_count;
  RAISE NOTICE '  Profiles with role "warehouse_owner": %', warehouse_owner_count;
  
  IF company_owner_count > 0 THEN
    RAISE WARNING 'There are still % profiles with "company_owner" role. Please review manually.', company_owner_count;
  END IF;
END $$;

