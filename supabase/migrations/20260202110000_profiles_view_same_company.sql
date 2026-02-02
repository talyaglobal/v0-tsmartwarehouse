-- Allow users to view profiles in the same company (for My Company team members list).
-- Corporate client admins/members have profiles.role = 'warehouse_client' and are not
-- considered "company admin" by is_company_admin(), so they could only see their own profile.
-- This policy lets any user with a company_id see other profiles with the same company_id.
DROP POLICY IF EXISTS "Users can view same-company profiles" ON profiles;
CREATE POLICY "Users can view same-company profiles"
  ON profiles FOR SELECT
  USING (
    status = true
    AND company_id IS NOT NULL
    AND company_id = public.get_user_company_id(auth.uid())
  );

COMMENT ON POLICY "Users can view same-company profiles" ON profiles IS 'Allow users to see other profiles in the same company (e.g. team members list on My Company)';
