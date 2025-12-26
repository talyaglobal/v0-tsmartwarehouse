-- Migrate all foreign key references from users(id) to profiles(id)
-- This migration updates all tables that reference users(id) to reference profiles(id) instead
-- After this, the users table can be safely dropped

-- ============================================
-- BOOKINGS TABLE
-- ============================================
-- Already migrated in 008_fix_bookings_customer_id_fkey.sql
-- Just verify it's correct
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bookings_customer_id_fkey' 
    AND table_name = 'bookings'
  ) THEN
    -- Check if it references profiles
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'bookings' 
      AND tc.constraint_name = 'bookings_customer_id_fkey'
      AND ccu.table_name = 'profiles'
    ) THEN
      ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey;
      ALTER TABLE bookings ADD CONSTRAINT bookings_customer_id_fkey 
        FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

-- ============================================
-- CLAIMS TABLE
-- ============================================
-- Already migrated in 009_fix_claims_customer_id_fkey.sql
-- Just verify it's correct
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'claims_customer_id_fkey' 
    AND table_name = 'claims'
  ) THEN
    -- Check if it references profiles
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'claims' 
      AND tc.constraint_name = 'claims_customer_id_fkey'
      AND ccu.table_name = 'profiles'
    ) THEN
      ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_customer_id_fkey;
      ALTER TABLE claims ADD CONSTRAINT claims_customer_id_fkey 
        FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

-- ============================================
-- INVOICES TABLE
-- ============================================
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE RESTRICT;

-- ============================================
-- TASKS TABLE
-- ============================================
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_fkey 
  FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================
-- INCIDENTS TABLE
-- ============================================
ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_reported_by_fkey;
ALTER TABLE incidents ADD CONSTRAINT incidents_reported_by_fkey 
  FOREIGN KEY (reported_by) REFERENCES profiles(id) ON DELETE RESTRICT;

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================
-- WORKER SHIFTS TABLE
-- ============================================
ALTER TABLE worker_shifts DROP CONSTRAINT IF EXISTS worker_shifts_worker_id_fkey;
ALTER TABLE worker_shifts ADD CONSTRAINT worker_shifts_worker_id_fkey 
  FOREIGN KEY (worker_id) REFERENCES profiles(id) ON DELETE RESTRICT;

-- ============================================
-- PAYMENTS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_customer_id_fkey;
    ALTER TABLE payments ADD CONSTRAINT payments_customer_id_fkey 
      FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- NOTIFICATION PREFERENCES TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_preferences') THEN
    ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;
    ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- INVENTORY ITEMS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items') THEN
    ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS inventory_items_customer_id_fkey;
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_customer_id_fkey 
      FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ============================================
-- INVENTORY MOVEMENTS TABLE (if exists)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_movements') THEN
    ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_moved_by_fkey;
    ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_moved_by_fkey 
      FOREIGN KEY (moved_by) REFERENCES profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ============================================
-- DROP USERS TABLE (if it exists and is not being used)
-- ============================================
-- First, check if users table has any data
DO $$
DECLARE
  user_count INTEGER;
  table_exists BOOLEAN;
BEGIN
  -- Check if users table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'users'
  ) INTO table_exists;
  
  IF table_exists THEN
    -- Count rows in users table
    EXECUTE 'SELECT COUNT(*) FROM users' INTO user_count;
    
    -- Only drop if table is empty or has very few rows (legacy data)
    IF user_count = 0 OR user_count < 10 THEN
      -- Drop triggers first
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      
      -- Drop indexes
      DROP INDEX IF EXISTS idx_users_email;
      DROP INDEX IF EXISTS idx_users_role;
      
      -- Drop the table
      DROP TABLE IF EXISTS users CASCADE;
      
      RAISE NOTICE 'Users table dropped successfully';
    ELSE
      RAISE WARNING 'Users table has % rows. Please review before dropping.', user_count;
    END IF;
  ELSE
    RAISE NOTICE 'Users table does not exist, skipping drop operation';
  END IF;
END $$;

