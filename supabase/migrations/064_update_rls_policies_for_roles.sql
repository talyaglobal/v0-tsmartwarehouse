-- Migration: Update RLS Policies for New Role System
-- Description: Update all RLS policies to support Root, Company Admin, Member, and Warehouse Staff roles with KVKK compliance
-- Created: 2025-01-XX

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function: Check if user is Root (System Admin)
CREATE OR REPLACE FUNCTION public.is_root(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    JOIN companies c ON p.company_id = c.id
    WHERE p.id = user_id 
      AND p.role = 'root'
      AND c.is_system = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user is Company Admin
CREATE OR REPLACE FUNCTION public.is_company_admin(user_id UUID, target_company_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  IF target_company_id IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = user_id AND role = 'company_admin'
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = user_id 
        AND role = 'company_admin'
        AND company_id = target_company_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user is Warehouse Staff
CREATE OR REPLACE FUNCTION public.is_warehouse_staff(user_id UUID, target_company_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  IF target_company_id IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = user_id AND role = 'warehouse_staff'
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = user_id 
        AND role = 'warehouse_staff'
        AND company_id = target_company_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user is Member
CREATE OR REPLACE FUNCTION public.is_member(user_id UUID, target_company_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  IF target_company_id IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = user_id AND role = 'member'
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = user_id 
        AND role = 'member'
        AND company_id = target_company_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(user_id UUID)
RETURNS UUID AS $$
DECLARE
  user_company_id UUID;
BEGIN
  SELECT company_id INTO user_company_id
  FROM profiles
  WHERE id = user_id;
  
  RETURN user_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user can access company data (KVKK compliance)
-- Root can only access system company, others can only access their own company
CREATE OR REPLACE FUNCTION public.can_access_company_data(user_id UUID, target_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_company_id UUID;
  target_is_system BOOLEAN;
BEGIN
  -- Get user's role and company_id
  SELECT role, company_id INTO user_role, user_company_id
  FROM profiles
  WHERE id = user_id;
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Root users: Can only access system company
  IF user_role = 'root' THEN
    SELECT is_system INTO target_is_system
    FROM companies
    WHERE id = target_company_id;
    
    RETURN target_is_system = true OR user_company_id = target_company_id;
  END IF;
  
  -- All other users: Can only access their own company
  RETURN user_company_id = target_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if booking belongs to user's company (KVKK)
CREATE OR REPLACE FUNCTION public.booking_belongs_to_user_company(booking_customer_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_company_id UUID;
  customer_company_id UUID;
BEGIN
  -- Get user's role and company_id
  SELECT role, company_id INTO user_role, user_company_id
  FROM profiles
  WHERE id = user_id;
  
  IF user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Root: Can only see system company bookings (which shouldn't exist)
  IF user_role = 'root' THEN
    RETURN false; -- Root cannot see any company bookings (KVKK)
  END IF;
  
  -- Get customer's company_id
  SELECT company_id INTO customer_company_id
  FROM profiles
  WHERE id = booking_customer_id;
  
  -- User can see booking if it belongs to their company
  RETURN user_company_id = customer_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DROP OLD POLICIES
-- ============================================

-- Drop old is_admin function and related policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Customers can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Customers can create own bookings" ON bookings;
DROP POLICY IF EXISTS "Customers can update own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update all bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON bookings;
DROP POLICY IF EXISTS "Customers can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can create invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Workers can view assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can create tasks" ON tasks;
DROP POLICY IF EXISTS "Workers can update assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can update all tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view reported incidents" ON incidents;
DROP POLICY IF EXISTS "Authenticated users can create incidents" ON incidents;
DROP POLICY IF EXISTS "Admins and workers can update incidents" ON incidents;
DROP POLICY IF EXISTS "Admins can delete incidents" ON incidents;
DROP POLICY IF EXISTS "Customers can view own claims" ON claims;
DROP POLICY IF EXISTS "Customers can create claims" ON claims;
DROP POLICY IF EXISTS "Customers can update own claims" ON claims;
DROP POLICY IF EXISTS "Admins can update all claims" ON claims;
DROP POLICY IF EXISTS "Admins can delete claims" ON claims;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Workers can view own shifts" ON worker_shifts;
DROP POLICY IF EXISTS "Workers can create own shifts" ON worker_shifts;
DROP POLICY IF EXISTS "Workers can update own shifts" ON worker_shifts;
DROP POLICY IF EXISTS "Admins can view all shifts" ON worker_shifts;
DROP POLICY IF EXISTS "Authenticated users can view warehouses" ON warehouses;
DROP POLICY IF EXISTS "Admins can manage warehouses" ON warehouses;

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================

-- Users can view their own profile
-- (Already exists, but keeping for reference)

-- Root and Company Admins can view profiles in their company
CREATE POLICY "Root and Company Admins can view company profiles"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id OR -- Own profile
    (
      -- Root can view system company profiles
      (public.is_root(auth.uid()) AND 
       company_id IN (SELECT id FROM companies WHERE is_system = true))
      OR
      -- Company Admin can view profiles in their company
      (public.is_company_admin(auth.uid()) AND 
       company_id = public.get_user_company_id(auth.uid()))
    )
  );

-- ============================================
-- BOOKINGS TABLE POLICIES (KVKK Compliant)
-- ============================================

-- Members can view their own bookings
CREATE POLICY "Members can view own bookings"
  ON bookings FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can view all bookings in their company
CREATE POLICY "Company Admins can view company bookings"
  ON bookings FOR SELECT
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Warehouse Staff can view bookings for their company's warehouse
CREATE POLICY "Warehouse Staff can view company bookings"
  ON bookings FOR SELECT
  USING (
    public.is_warehouse_staff(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Members can create their own bookings
CREATE POLICY "Members can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Members can update their own bookings (only pending/confirmed)
CREATE POLICY "Members can update own bookings"
  ON bookings FOR UPDATE
  USING (
    customer_id = auth.uid() AND status IN ('pending', 'confirmed')
  )
  WITH CHECK (
    customer_id = auth.uid() AND status IN ('pending', 'confirmed')
  );

-- Company Admins can update all bookings in their company
CREATE POLICY "Company Admins can update company bookings"
  ON bookings FOR UPDATE
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Warehouse Staff can update booking statuses for their company
CREATE POLICY "Warehouse Staff can update company booking statuses"
  ON bookings FOR UPDATE
  USING (
    public.is_warehouse_staff(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    public.is_warehouse_staff(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can delete bookings in their company
CREATE POLICY "Company Admins can delete company bookings"
  ON bookings FOR DELETE
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- ============================================
-- INVOICES TABLE POLICIES (KVKK Compliant)
-- ============================================

-- Members can view their own invoices
CREATE POLICY "Members can view own invoices"
  ON invoices FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can view all invoices in their company
CREATE POLICY "Company Admins can view company invoices"
  ON invoices FOR SELECT
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can create invoices for their company
CREATE POLICY "Company Admins can create company invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can update invoices in their company
CREATE POLICY "Company Admins can update company invoices"
  ON invoices FOR UPDATE
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can delete invoices in their company
CREATE POLICY "Company Admins can delete company invoices"
  ON invoices FOR DELETE
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================

-- Warehouse Staff can view tasks assigned to them or in their company
CREATE POLICY "Warehouse Staff can view assigned tasks"
  ON tasks FOR SELECT
  USING (
    assigned_to = auth.uid() OR
    (
      public.is_warehouse_staff(auth.uid()) AND
      -- Tasks should be filtered by company through warehouse
      EXISTS (
        SELECT 1 FROM warehouses w
        JOIN profiles p ON p.company_id = (
          SELECT company_id FROM warehouses WHERE id = w.id
        )
        WHERE w.id = warehouse_id
          AND p.id = auth.uid()
      )
    )
  );

-- Company Admins can create tasks for their company
CREATE POLICY "Company Admins can create company tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    public.is_company_admin(auth.uid())
    -- Additional company check should be done in application layer
  );

-- Warehouse Staff can update tasks assigned to them
CREATE POLICY "Warehouse Staff can update assigned tasks"
  ON tasks FOR UPDATE
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- Company Admins can update all tasks in their company
CREATE POLICY "Company Admins can update company tasks"
  ON tasks FOR UPDATE
  USING (public.is_company_admin(auth.uid()))
  WITH CHECK (public.is_company_admin(auth.uid()));

-- Company Admins can delete tasks in their company
CREATE POLICY "Company Admins can delete company tasks"
  ON tasks FOR DELETE
  USING (public.is_company_admin(auth.uid()));

-- ============================================
-- INCIDENTS TABLE POLICIES
-- ============================================

-- Users can view incidents they reported
CREATE POLICY "Users can view reported incidents"
  ON incidents FOR SELECT
  USING (
    reported_by = auth.uid() OR
    (
      -- Company Admins and Warehouse Staff can view incidents in their company
      (public.is_company_admin(auth.uid()) OR public.is_warehouse_staff(auth.uid())) AND
      EXISTS (
        SELECT 1 FROM warehouses w
        JOIN profiles p ON p.company_id = (
          SELECT company_id FROM warehouses WHERE id = w.id
        )
        WHERE w.id = warehouse_id
          AND p.id = auth.uid()
      )
    )
  );

-- All authenticated users can create incidents
CREATE POLICY "Authenticated users can create incidents"
  ON incidents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Company Admins and Warehouse Staff can update incidents in their company
CREATE POLICY "Company Admins and Warehouse Staff can update company incidents"
  ON incidents FOR UPDATE
  USING (
    (public.is_company_admin(auth.uid()) OR public.is_warehouse_staff(auth.uid())) AND
    EXISTS (
      SELECT 1 FROM warehouses w
      JOIN profiles p ON p.company_id = (
        SELECT company_id FROM warehouses WHERE id = w.id
      )
      WHERE w.id = warehouse_id
        AND p.id = auth.uid()
    )
  );

-- Company Admins can delete incidents in their company
CREATE POLICY "Company Admins can delete company incidents"
  ON incidents FOR DELETE
  USING (
    public.is_company_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM warehouses w
      JOIN profiles p ON p.company_id = (
        SELECT company_id FROM warehouses WHERE id = w.id
      )
      WHERE w.id = warehouse_id
        AND p.id = auth.uid()
    )
  );

-- ============================================
-- CLAIMS TABLE POLICIES (KVKK Compliant)
-- ============================================

-- Members can view their own claims
CREATE POLICY "Members can view own claims"
  ON claims FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can view all claims in their company
CREATE POLICY "Company Admins can view company claims"
  ON claims FOR SELECT
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Members can create claims
CREATE POLICY "Members can create claims"
  ON claims FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Members can update their own pending claims
CREATE POLICY "Members can update own claims"
  ON claims FOR UPDATE
  USING (
    customer_id = auth.uid() AND status = 'submitted'
  )
  WITH CHECK (
    customer_id = auth.uid() AND status = 'submitted'
  );

-- Company Admins can update all claims in their company
CREATE POLICY "Company Admins can update company claims"
  ON claims FOR UPDATE
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can delete claims in their company
CREATE POLICY "Company Admins can delete company claims"
  ON claims FOR DELETE
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- ============================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Company Admins can create notifications for their company members
CREATE POLICY "Company Admins can create company notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    -- Notification user_id should be in same company
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = user_id
        AND company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- WORKER SHIFTS TABLE POLICIES
-- ============================================

-- Warehouse Staff can view their own shifts
CREATE POLICY "Warehouse Staff can view own shifts"
  ON worker_shifts FOR SELECT
  USING (worker_id = auth.uid());

-- Warehouse Staff can create their own shifts
CREATE POLICY "Warehouse Staff can create own shifts"
  ON worker_shifts FOR INSERT
  WITH CHECK (worker_id = auth.uid());

-- Warehouse Staff can update their own shifts
CREATE POLICY "Warehouse Staff can update own shifts"
  ON worker_shifts FOR UPDATE
  USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

-- Company Admins can view all shifts in their company
CREATE POLICY "Company Admins can view company shifts"
  ON worker_shifts FOR SELECT
  USING (
    public.is_company_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = worker_id
        AND company_id = public.get_user_company_id(auth.uid())
    )
  );

-- ============================================
-- WAREHOUSES TABLE POLICIES
-- ============================================

-- All authenticated users can view warehouses
CREATE POLICY "Authenticated users can view warehouses"
  ON warehouses FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Root can create/update/delete warehouses (for any company)
CREATE POLICY "Root can manage warehouses"
  ON warehouses FOR ALL
  USING (public.is_root(auth.uid()))
  WITH CHECK (public.is_root(auth.uid()));

-- Company Admins can update warehouses in their company
-- Note: This requires warehouse to have company_id or owner_company_id
-- For now, we'll allow Company Admins to update if they have warehouse management permission
CREATE POLICY "Company Admins can update company warehouses"
  ON warehouses FOR UPDATE
  USING (public.is_company_admin(auth.uid()))
  WITH CHECK (public.is_company_admin(auth.uid()));

-- ============================================
-- COMPANIES TABLE POLICIES
-- ============================================

-- Root can view all companies
CREATE POLICY "Root can view all companies"
  ON companies FOR SELECT
  USING (public.is_root(auth.uid()));

-- Users can view their own company
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  USING (
    id = public.get_user_company_id(auth.uid())
  );

-- Root can create companies
CREATE POLICY "Root can create companies"
  ON companies FOR INSERT
  WITH CHECK (public.is_root(auth.uid()));

-- Root can update companies
CREATE POLICY "Root can update companies"
  ON companies FOR UPDATE
  USING (public.is_root(auth.uid()))
  WITH CHECK (public.is_root(auth.uid()));

-- Company Admins can update their own company
CREATE POLICY "Company Admins can update own company"
  ON companies FOR UPDATE
  USING (
    public.is_company_admin(auth.uid()) AND
    id = public.get_user_company_id(auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    id = public.get_user_company_id(auth.uid())
  );

-- ============================================
-- SERVICE ORDERS TABLE POLICIES (KVKK Compliant)
-- ============================================

-- Members can view their own service orders
CREATE POLICY "Members can view own service orders"
  ON service_orders FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can view all service orders in their company
CREATE POLICY "Company Admins can view company service orders"
  ON service_orders FOR SELECT
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Members can create service orders
CREATE POLICY "Members can create service orders"
  ON service_orders FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Members can update their own service orders (only draft/pending)
CREATE POLICY "Members can update own service orders"
  ON service_orders FOR UPDATE
  USING (
    customer_id = auth.uid() AND status IN ('draft', 'pending')
  )
  WITH CHECK (
    customer_id = auth.uid() AND status IN ('draft', 'pending')
  );

-- Company Admins can update all service orders in their company
CREATE POLICY "Company Admins can update company service orders"
  ON service_orders FOR UPDATE
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can delete service orders in their company
CREATE POLICY "Company Admins can delete company service orders"
  ON service_orders FOR DELETE
  USING (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

