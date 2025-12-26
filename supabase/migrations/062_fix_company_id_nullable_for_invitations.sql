-- Fix company_id to be nullable for invitations
-- This migration ensures company_id can be NULL to support invitation flow
-- where users are invited but haven't yet accepted the invitation

-- First, check if company_id has NOT NULL constraint
DO $$
BEGIN
  -- Try to drop NOT NULL constraint if it exists
  ALTER TABLE profiles
  ALTER COLUMN company_id DROP NOT NULL;
  
  RAISE NOTICE 'company_id is now nullable';
EXCEPTION
  WHEN OTHERS THEN
    -- If constraint doesn't exist, that's fine
    RAISE NOTICE 'company_id is already nullable or constraint does not exist: %', SQLERRM;
END $$;

-- Add comment to explain why company_id can be NULL
COMMENT ON COLUMN profiles.company_id IS 'Company ID. Can be NULL for users who are invited but haven''t accepted the invitation yet.';

