-- Remove company column from profiles table
-- This column is redundant since we now use company_id (foreign key to companies table)

-- Drop the company column
ALTER TABLE profiles 
DROP COLUMN IF EXISTS company;

