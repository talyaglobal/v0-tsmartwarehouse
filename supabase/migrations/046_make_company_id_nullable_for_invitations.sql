-- Make company_id nullable in profiles table
-- This allows users to exist without a company_id until they accept an invitation
-- or join a company

-- Remove NOT NULL constraint from company_id if it exists
ALTER TABLE profiles
ALTER COLUMN company_id DROP NOT NULL;

-- Note: This migration allows profiles to have NULL company_id,
-- which is necessary for invitation flow where users are invited
-- but haven't yet accepted the invitation to join a company.

