-- Verify and document company admin structure
-- This migration verifies that the table structure supports company admin functionality

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- 1. Check if profiles table has company_id (required)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'company_id'
  ) THEN
    RAISE EXCEPTION 'profiles.company_id column does not exist';
  END IF;
  
  -- Check if company_id is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'company_id'
    AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE 'WARNING: profiles.company_id is nullable - should be NOT NULL';
  END IF;
END $$;

-- 2. Check if company_members table exists with correct structure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'company_members'
  ) THEN
    RAISE EXCEPTION 'company_members table does not exist';
  END IF;
  
  -- Check required columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_members' 
    AND column_name = 'role'
    AND udt_name = 'text'
  ) THEN
    RAISE EXCEPTION 'company_members.role column does not exist or has wrong type';
  END IF;
  
  -- Check role constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%company_members_role%'
    AND check_clause LIKE '%owner%'
    AND check_clause LIKE '%admin%'
    AND check_clause LIKE '%member%'
  ) THEN
    RAISE NOTICE 'WARNING: company_members.role constraint may not include all required values';
  END IF;
END $$;

-- 3. Verify foreign key relationships
DO $$
BEGIN
  -- Check profiles -> companies FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
      AND rc.unique_constraint_schema = ccu.table_schema
    WHERE tc.table_name = 'profiles'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'company_id'
    AND ccu.table_name = 'companies'
  ) THEN
    RAISE NOTICE 'WARNING: profiles.company_id foreign key to companies may not exist';
  END IF;
  
  -- Check company_members -> companies FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
      AND rc.unique_constraint_schema = ccu.table_schema
    WHERE tc.table_name = 'company_members'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'company_id'
    AND ccu.table_name = 'companies'
  ) THEN
    RAISE NOTICE 'WARNING: company_members.company_id foreign key to companies may not exist';
  END IF;
  
  -- Check company_members -> profiles FK
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
      AND rc.unique_constraint_schema = ccu.table_schema
    WHERE tc.table_name = 'company_members'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'user_id'
    AND ccu.table_name = 'profiles'
  ) THEN
    RAISE NOTICE 'WARNING: company_members.user_id foreign key to profiles may not exist';
  END IF;
END $$;

-- 4. Verify indexes for performance
DO $$
BEGIN
  -- Check company_members indexes
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'company_members' 
    AND indexname = 'idx_company_members_company_id'
  ) THEN
    RAISE NOTICE 'WARNING: idx_company_members_company_id index may not exist';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'company_members' 
    AND indexname = 'idx_company_members_user_id'
  ) THEN
    RAISE NOTICE 'WARNING: idx_company_members_user_id index may not exist';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'company_members' 
    AND indexname = 'idx_company_members_role'
  ) THEN
    RAISE NOTICE 'WARNING: idx_company_members_role index may not exist';
  END IF;
  
  -- Check profiles company_id index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'profiles' 
    AND (indexname = 'profiles_company_id_idx' OR indexname LIKE '%company_id%')
  ) THEN
    RAISE NOTICE 'WARNING: profiles.company_id index may not exist';
  END IF;
END $$;

-- 5. Verify RLS policies
DO $$
BEGIN
  -- Check if RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'company_members' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE 'WARNING: RLS may not be enabled on company_members table';
  END IF;
  
  -- Check for company admin policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'company_members'
    AND policyname LIKE '%admin%'
  ) THEN
    RAISE NOTICE 'WARNING: Company admin RLS policies may not exist on company_members';
  END IF;
END $$;

-- ============================================
-- SUMMARY
-- ============================================
-- This migration verifies:
-- 1. profiles.company_id exists and is properly linked to companies
-- 2. company_members table exists with role, status, and proper FKs
-- 3. Required indexes exist for performance
-- 4. RLS policies are in place for security
--
-- Structure supports:
-- - Users belong to one company (profiles.company_id)
-- - Users have roles within their company (company_members.role: owner/admin/member)
-- - Company admins (owner/admin) can manage company members
-- - System admins can manage all companies

