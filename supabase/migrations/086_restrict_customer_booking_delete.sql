-- Migration: Restrict customer booking delete permissions
-- Customers can only cancel bookings (update status to 'cancelled'), not delete them
-- Only company staff (company_owner, company_admin, warehouse_staff) can delete bookings

-- Drop existing delete policy if exists
DROP POLICY IF EXISTS "Company Admins can delete company bookings" ON bookings;

-- Recreate delete policy with stricter rules
-- Only allow company_owner, company_admin, warehouse_staff, and root to delete
CREATE POLICY "Company staff can delete company bookings"
  ON bookings FOR DELETE
  USING (
    -- Root users can delete any booking
    public.is_root(auth.uid()) OR
    (
      -- Company staff can delete bookings to their warehouses
      (
        public.get_user_role(auth.uid()) IN ('company_owner', 'company_admin', 'warehouse_staff')
      ) AND
      public.booking_belongs_to_user_company(customer_id, auth.uid())
    )
  );

-- Ensure customers can still update bookings (for cancellation)
-- Drop and recreate update policy
DROP POLICY IF EXISTS "Members can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Company Admins can update company bookings" ON bookings;

-- Customers can update their own bookings (mainly for cancellation)
CREATE POLICY "Customers can update own bookings"
  ON bookings FOR UPDATE
  USING (
    -- Customers can only update their own bookings
    customer_id = auth.uid() AND
    public.get_user_role(auth.uid()) = 'customer'
  )
  WITH CHECK (
    -- Customers can only update their own bookings
    customer_id = auth.uid() AND
    public.get_user_role(auth.uid()) = 'customer'
  );

-- Company staff can update bookings to their warehouses
CREATE POLICY "Company staff can update company bookings"
  ON bookings FOR UPDATE
  USING (
    public.is_root(auth.uid()) OR
    (
      public.get_user_role(auth.uid()) IN ('company_owner', 'company_admin', 'warehouse_staff') AND
      public.booking_belongs_to_user_company(customer_id, auth.uid())
    )
  )
  WITH CHECK (
    public.is_root(auth.uid()) OR
    (
      public.get_user_role(auth.uid()) IN ('company_owner', 'company_admin', 'warehouse_staff') AND
      public.booking_belongs_to_user_company(customer_id, auth.uid())
    )
  );

-- Add comment explaining the policies
COMMENT ON POLICY "Company staff can delete company bookings" ON bookings IS
  'Only company staff (owner, admin, warehouse_staff) and root can delete bookings. Customers must use cancellation instead.';

COMMENT ON POLICY "Customers can update own bookings" ON bookings IS
  'Customers can update (mainly cancel) their own bookings.';

COMMENT ON POLICY "Company staff can update company bookings" ON bookings IS
  'Company staff can update any booking to warehouses in their company.';
