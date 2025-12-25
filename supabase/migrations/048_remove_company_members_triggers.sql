-- Remove triggers and functions that reference company_members table
-- These were created in migration 040 but are no longer needed since company_members table was removed

-- Drop triggers
DROP TRIGGER IF EXISTS ensure_company_member_on_profile_update ON profiles;
DROP TRIGGER IF EXISTS ensure_company_member_on_profile_insert ON profiles;

-- Drop function
DROP FUNCTION IF EXISTS public.ensure_company_member_consistency();

