-- Add INSERT policy for profiles table
-- This allows the system to create profiles when users register
-- The trigger uses SECURITY DEFINER, but we also need a policy for manual inserts

-- Allow service role (admin operations) to insert profiles
-- Service role key bypasses RLS, but this policy is for completeness
-- Also allow users to insert their own profile (for manual creation if trigger fails)
CREATE POLICY "Service can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- Note: The trigger function handle_new_user() uses SECURITY DEFINER,
-- which means it runs with the privileges of the function owner (postgres),
-- bypassing RLS. This policy is mainly for manual inserts using service role.

