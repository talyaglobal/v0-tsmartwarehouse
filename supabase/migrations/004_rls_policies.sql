-- TSmart Warehouse Management System - Row Level Security Policies
-- This migration contains comprehensive RLS policies for all tables
-- Run this after the initial schema migration

-- ============================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = user_id AND profiles.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================
-- (Policies already created in 001_create_profiles_table.sql)
-- Users can view own profile - already exists
-- Users can update own profile - already exists

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================
-- BOOKINGS TABLE POLICIES
-- ============================================
-- Customers can view their own bookings
CREATE POLICY "Customers can view own bookings"
  ON bookings FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.is_admin(auth.uid())
  );

-- Customers can create their own bookings
CREATE POLICY "Customers can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    customer_id = auth.uid() OR
    public.is_admin(auth.uid())
  );

-- Customers can update their own bookings (only pending/confirmed status)
CREATE POLICY "Customers can update own bookings"
  ON bookings FOR UPDATE
  USING (
    (customer_id = auth.uid() AND status IN ('pending', 'confirmed')) OR
    public.is_admin(auth.uid())
  )
  WITH CHECK (
    (customer_id = auth.uid() AND status IN ('pending', 'confirmed')) OR
    public.is_admin(auth.uid())
  );

-- Admins can update all bookings
CREATE POLICY "Admins can update all bookings"
  ON bookings FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins can delete bookings
CREATE POLICY "Admins can delete bookings"
  ON bookings FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ============================================
-- INVOICES TABLE POLICIES
-- ============================================
-- Customers can view their own invoices
CREATE POLICY "Customers can view own invoices"
  ON invoices FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.is_admin(auth.uid())
  );

-- Admins can create invoices
CREATE POLICY "Admins can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins can update invoices
CREATE POLICY "Admins can update invoices"
  ON invoices FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins can delete invoices
CREATE POLICY "Admins can delete invoices"
  ON invoices FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================
-- Workers can view tasks assigned to them
CREATE POLICY "Workers can view assigned tasks"
  ON tasks FOR SELECT
  USING (
    assigned_to = auth.uid() OR
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'worker'
    )
  );

-- Admins can create tasks
CREATE POLICY "Admins can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Workers can update tasks assigned to them
CREATE POLICY "Workers can update assigned tasks"
  ON tasks FOR UPDATE
  USING (
    assigned_to = auth.uid() OR
    public.is_admin(auth.uid())
  )
  WITH CHECK (
    assigned_to = auth.uid() OR
    public.is_admin(auth.uid())
  );

-- Admins can update all tasks
CREATE POLICY "Admins can update all tasks"
  ON tasks FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins can delete tasks
CREATE POLICY "Admins can delete tasks"
  ON tasks FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ============================================
-- INCIDENTS TABLE POLICIES
-- ============================================
-- Users can view incidents they reported
CREATE POLICY "Users can view reported incidents"
  ON incidents FOR SELECT
  USING (
    reported_by = auth.uid() OR
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'worker'
    )
  );

-- All authenticated users can report incidents
CREATE POLICY "Authenticated users can create incidents"
  ON incidents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admins and workers can update incidents
CREATE POLICY "Admins and workers can update incidents"
  ON incidents FOR UPDATE
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'worker'
    )
  );

-- Admins can delete incidents
CREATE POLICY "Admins can delete incidents"
  ON incidents FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ============================================
-- CLAIMS TABLE POLICIES
-- ============================================
-- Customers can view their own claims
CREATE POLICY "Customers can view own claims"
  ON claims FOR SELECT
  USING (
    customer_id = auth.uid() OR
    public.is_admin(auth.uid())
  );

-- Customers can create claims
CREATE POLICY "Customers can create claims"
  ON claims FOR INSERT
  WITH CHECK (
    customer_id = auth.uid() OR
    public.is_admin(auth.uid())
  );

-- Customers can update their own pending claims
CREATE POLICY "Customers can update own claims"
  ON claims FOR UPDATE
  USING (
    (customer_id = auth.uid() AND status = 'submitted') OR
    public.is_admin(auth.uid())
  )
  WITH CHECK (
    (customer_id = auth.uid() AND status = 'submitted') OR
    public.is_admin(auth.uid())
  );

-- Admins can update all claims
CREATE POLICY "Admins can update all claims"
  ON claims FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins can delete claims
CREATE POLICY "Admins can delete claims"
  ON claims FOR DELETE
  USING (public.is_admin(auth.uid()));

-- ============================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================
-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (
    user_id = auth.uid() OR
    public.is_admin(auth.uid())
  );

-- System can create notifications (using service role)
-- Admins can create notifications
CREATE POLICY "Admins can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Users can update their own notifications (mark as read)
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
-- Workers can view their own shifts
CREATE POLICY "Workers can view own shifts"
  ON worker_shifts FOR SELECT
  USING (
    worker_id = auth.uid() OR
    public.is_admin(auth.uid())
  );

-- Workers can create their own shifts (check-in)
CREATE POLICY "Workers can create own shifts"
  ON worker_shifts FOR INSERT
  WITH CHECK (
    worker_id = auth.uid() OR
    public.is_admin(auth.uid())
  );

-- Workers can update their own shifts (check-out)
CREATE POLICY "Workers can update own shifts"
  ON worker_shifts FOR UPDATE
  USING (
    worker_id = auth.uid() OR
    public.is_admin(auth.uid())
  )
  WITH CHECK (
    worker_id = auth.uid() OR
    public.is_admin(auth.uid())
  );

-- Admins can view all shifts
CREATE POLICY "Admins can view all shifts"
  ON worker_shifts FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================
-- WAREHOUSES TABLE POLICIES
-- ============================================
-- All authenticated users can view warehouses
CREATE POLICY "Authenticated users can view warehouses"
  ON warehouses FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can modify warehouses
CREATE POLICY "Admins can manage warehouses"
  ON warehouses FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- WAREHOUSE FLOORS/HALLS/ZONES POLICIES
-- ============================================
-- All authenticated users can view warehouse structure
CREATE POLICY "Authenticated users can view warehouse floors"
  ON warehouse_floors FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view warehouse halls"
  ON warehouse_halls FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view warehouse zones"
  ON warehouse_zones FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can modify warehouse structure
CREATE POLICY "Admins can manage warehouse floors"
  ON warehouse_floors FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage warehouse halls"
  ON warehouse_halls FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage warehouse zones"
  ON warehouse_zones FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- USERS TABLE POLICIES
-- ============================================
-- Users can view their own user record
CREATE POLICY "Users can view own user record"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Admins can view all users
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admins can create users
CREATE POLICY "Admins can create users"
  ON users FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins can update users
CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins can delete users
CREATE POLICY "Admins can delete users"
  ON users FOR DELETE
  USING (public.is_admin(auth.uid()));

