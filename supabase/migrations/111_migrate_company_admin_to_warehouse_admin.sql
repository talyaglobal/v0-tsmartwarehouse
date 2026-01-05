-- Migrate 'company_admin' role to 'warehouse_admin' in profiles table
-- This migration updates all profiles with role = 'company_admin' to role = 'warehouse_admin'
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

-- Step 2: Add temporary constraint that allows both 'company_admin' and 'warehouse_admin'
-- This allows us to update existing rows without constraint violations
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check_temp
CHECK (role IN ('root', 'warehouse_owner', 'company_admin', 'warehouse_admin', 'customer', 'warehouse_staff'));

-- Step 3: Update all profiles with role = 'company_admin' to role = 'warehouse_admin'
UPDATE profiles
SET role = 'warehouse_admin'
WHERE role = 'company_admin';

-- Step 4: Update company_members table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_members') THEN
    -- Update company_members role column if it has company_admin
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'company_members' AND column_name = 'role'
    ) THEN
      UPDATE company_members
      SET role = 'warehouse_admin'
      WHERE role = 'company_admin';
    END IF;
  END IF;
END $$;

-- Step 5: Drop temporary constraint and add final constraint without 'company_admin'
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_role_check_temp;

ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('root', 'warehouse_owner', 'warehouse_admin', 'customer', 'warehouse_staff'));

-- Step 6: Update RLS policies that reference 'company_admin' role
-- Update audit logs policy
DROP POLICY IF EXISTS "Company admins can view company audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Warehouse admins can view company audit logs" ON audit_logs;
CREATE POLICY "Warehouse admins can view company audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('warehouse_owner', 'warehouse_admin')
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
  DROP POLICY IF EXISTS "Warehouse admins can view company services" ON company_services;
  DROP POLICY IF EXISTS "Warehouse admins can create company services" ON company_services;
  DROP POLICY IF EXISTS "Warehouse admins can update company services" ON company_services;
  DROP POLICY IF EXISTS "Warehouse admins can delete company services" ON company_services;
  
  CREATE POLICY "Warehouse admins can view company services"
  ON company_services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND p.company_id = company_services.company_id
    )
  );
  
  CREATE POLICY "Warehouse admins can create company services"
  ON company_services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND p.company_id = company_services.company_id
    )
  );
  
  CREATE POLICY "Warehouse admins can update company services"
  ON company_services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND p.company_id = company_services.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND p.company_id = company_services.company_id
    )
  );
  
  CREATE POLICY "Warehouse admins can delete company services"
  ON company_services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND p.company_id = company_services.company_id
    )
  );
END $$;

-- Update warehouse_reviews policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Company admins can view company reviews" ON warehouse_reviews;
  DROP POLICY IF EXISTS "Warehouse admins can view company reviews" ON warehouse_reviews;
  CREATE POLICY "Warehouse admins can view company reviews"
  ON warehouse_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.owner_company_id = p.company_id
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND w.id = warehouse_reviews.warehouse_id
    )
  );
END $$;

-- Update conversations policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Company admins can view company conversations" ON conversations;
  DROP POLICY IF EXISTS "Warehouse admins can view company conversations" ON conversations;
  CREATE POLICY "Warehouse admins can view company conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.owner_company_id = p.company_id
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND w.id = conversations.warehouse_id
    )
  );
END $$;

-- Update warehouse_services policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Company admins can view warehouse services" ON warehouse_services;
  DROP POLICY IF EXISTS "Company admins can create warehouse services" ON warehouse_services;
  DROP POLICY IF EXISTS "Company admins can update warehouse services" ON warehouse_services;
  DROP POLICY IF EXISTS "Company admins can delete warehouse services" ON warehouse_services;
  DROP POLICY IF EXISTS "Warehouse admins can view warehouse services" ON warehouse_services;
  DROP POLICY IF EXISTS "Warehouse admins can create warehouse services" ON warehouse_services;
  DROP POLICY IF EXISTS "Warehouse admins can update warehouse services" ON warehouse_services;
  DROP POLICY IF EXISTS "Warehouse admins can delete warehouse services" ON warehouse_services;
  
  CREATE POLICY "Warehouse admins can view warehouse services"
  ON warehouse_services FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.owner_company_id = p.company_id
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND w.id = warehouse_services.warehouse_id
    )
  );
  
  CREATE POLICY "Warehouse admins can create warehouse services"
  ON warehouse_services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.owner_company_id = p.company_id
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND w.id = warehouse_services.warehouse_id
    )
  );
  
  CREATE POLICY "Warehouse admins can update warehouse services"
  ON warehouse_services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.owner_company_id = p.company_id
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND w.id = warehouse_services.warehouse_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.owner_company_id = p.company_id
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND w.id = warehouse_services.warehouse_id
    )
  );
  
  CREATE POLICY "Warehouse admins can delete warehouse services"
  ON warehouse_services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.owner_company_id = p.company_id
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND w.id = warehouse_services.warehouse_id
    )
  );
END $$;

-- Update bookings policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Company admins can view company bookings" ON bookings;
  DROP POLICY IF EXISTS "Warehouse admins can view company bookings" ON bookings;
  CREATE POLICY "Warehouse admins can view company bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN warehouses w ON w.owner_company_id = p.company_id
      WHERE p.id = auth.uid()
      AND (p.role = 'root' OR p.role = 'warehouse_admin' OR p.role = 'warehouse_owner')
      AND w.id = bookings.warehouse_id
    )
  );
END $$;

-- Step 7: Update the comment on the role column
COMMENT ON COLUMN profiles.role IS 'User role: root (System Admin), warehouse_owner (Warehouse Owner), warehouse_admin (Warehouse Admin), customer (Customer/Member), warehouse_staff (Warehouse Staff)';

-- Step 8: Verify migration
DO $$
DECLARE
  company_admin_count INTEGER;
  warehouse_admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO company_admin_count FROM profiles WHERE role = 'company_admin';
  SELECT COUNT(*) INTO warehouse_admin_count FROM profiles WHERE role = 'warehouse_admin';
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '  Profiles with role "company_admin" (should be 0): %', company_admin_count;
  RAISE NOTICE '  Profiles with role "warehouse_admin": %', warehouse_admin_count;
  
  IF company_admin_count > 0 THEN
    RAISE WARNING 'There are still % profiles with "company_admin" role. Please review manually.', company_admin_count;
  END IF;
END $$;

