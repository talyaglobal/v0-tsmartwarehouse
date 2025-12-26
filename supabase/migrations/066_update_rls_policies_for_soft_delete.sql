-- Migration: Update RLS Policies for Soft Delete
-- Description: Add status = true filter to all RLS policies to implement soft delete
-- Created: 2025-01-XX
-- 
-- This migration updates all existing RLS policies to filter by status = true
-- Only non-deleted records (status = true) will be visible through RLS

-- ============================================
-- HELPER: Update policy USING clause
-- ============================================
-- We'll drop and recreate policies with status = true filter

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================

-- Drop existing policy and recreate with status filter
DROP POLICY IF EXISTS "Root and Company Admins can view company profiles" ON profiles;
CREATE POLICY "Root and Company Admins can view company profiles"
  ON profiles FOR SELECT
  USING (
    status = true AND (
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
    )
  );

-- ============================================
-- BOOKINGS TABLE POLICIES
-- ============================================

-- Members can view their own bookings
DROP POLICY IF EXISTS "Members can view own bookings" ON bookings;
CREATE POLICY "Members can view own bookings"
  ON bookings FOR SELECT
  USING (
    status = true AND (
      customer_id = auth.uid() OR
      public.booking_belongs_to_user_company(customer_id, auth.uid())
    )
  );

-- Company Admins can view all bookings in their company
DROP POLICY IF EXISTS "Company Admins can view company bookings" ON bookings;
CREATE POLICY "Company Admins can view company bookings"
  ON bookings FOR SELECT
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Warehouse Staff can view bookings for their company's warehouse
DROP POLICY IF EXISTS "Warehouse Staff can view company bookings" ON bookings;
CREATE POLICY "Warehouse Staff can view company bookings"
  ON bookings FOR SELECT
  USING (
    status = true AND
    public.is_warehouse_staff(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Members can create their own bookings
DROP POLICY IF EXISTS "Members can create own bookings" ON bookings;
CREATE POLICY "Members can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Members can update their own bookings (only pending/confirmed) - Note: booking_status now
DROP POLICY IF EXISTS "Members can update own bookings" ON bookings;
CREATE POLICY "Members can update own bookings"
  ON bookings FOR UPDATE
  USING (
    status = true AND
    customer_id = auth.uid() AND booking_status IN ('pending', 'confirmed')
  )
  WITH CHECK (
    status = true AND
    customer_id = auth.uid() AND booking_status IN ('pending', 'confirmed')
  );

-- Company Admins can update all bookings in their company
DROP POLICY IF EXISTS "Company Admins can update company bookings" ON bookings;
CREATE POLICY "Company Admins can update company bookings"
  ON bookings FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Warehouse Staff can update booking statuses for their company
DROP POLICY IF EXISTS "Warehouse Staff can update company booking statuses" ON bookings;
CREATE POLICY "Warehouse Staff can update company booking statuses"
  ON bookings FOR UPDATE
  USING (
    status = true AND
    public.is_warehouse_staff(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    status = true AND
    public.is_warehouse_staff(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can delete bookings in their company (soft delete)
DROP POLICY IF EXISTS "Company Admins can delete company bookings" ON bookings;
CREATE POLICY "Company Admins can delete company bookings"
  ON bookings FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- ============================================
-- INVOICES TABLE POLICIES
-- ============================================

-- Members can view their own invoices
DROP POLICY IF EXISTS "Members can view own invoices" ON invoices;
CREATE POLICY "Members can view own invoices"
  ON invoices FOR SELECT
  USING (
    status = true AND (
      customer_id = auth.uid() OR
      public.booking_belongs_to_user_company(customer_id, auth.uid())
    )
  );

-- Company Admins can view all invoices in their company
DROP POLICY IF EXISTS "Company Admins can view company invoices" ON invoices;
CREATE POLICY "Company Admins can view company invoices"
  ON invoices FOR SELECT
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can create invoices for their company
DROP POLICY IF EXISTS "Company Admins can create company invoices" ON invoices;
CREATE POLICY "Company Admins can create company invoices"
  ON invoices FOR INSERT
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can update invoices in their company
DROP POLICY IF EXISTS "Company Admins can update company invoices" ON invoices;
CREATE POLICY "Company Admins can update company invoices"
  ON invoices FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can delete invoices in their company (soft delete)
DROP POLICY IF EXISTS "Company Admins can delete company invoices" ON invoices;
CREATE POLICY "Company Admins can delete company invoices"
  ON invoices FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================

-- Warehouse Staff can view tasks assigned to them or in their company
DROP POLICY IF EXISTS "Warehouse Staff can view assigned tasks" ON tasks;
CREATE POLICY "Warehouse Staff can view assigned tasks"
  ON tasks FOR SELECT
  USING (
    status = true AND (
      assigned_to = auth.uid() OR
      (
        public.is_warehouse_staff(auth.uid()) AND
        EXISTS (
          SELECT 1 FROM warehouses w
          JOIN profiles p ON p.company_id = (
            SELECT company_id FROM warehouses WHERE id = w.id
          )
          WHERE w.id = warehouse_id
            AND p.id = auth.uid()
        )
      )
    )
  );

-- Company Admins can view tasks in their company
DROP POLICY IF EXISTS "Company Admins can view company tasks" ON tasks;
CREATE POLICY "Company Admins can view company tasks"
  ON tasks FOR SELECT
  USING (
    status = true AND
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

-- Company Admins can create tasks
DROP POLICY IF EXISTS "Company Admins can create company tasks" ON tasks;
CREATE POLICY "Company Admins can create company tasks"
  ON tasks FOR INSERT
  WITH CHECK (public.is_company_admin(auth.uid()));

-- Warehouse Staff can update tasks assigned to them
DROP POLICY IF EXISTS "Warehouse Staff can update assigned tasks" ON tasks;
CREATE POLICY "Warehouse Staff can update assigned tasks"
  ON tasks FOR UPDATE
  USING (
    status = true AND assigned_to = auth.uid()
  )
  WITH CHECK (
    status = true AND assigned_to = auth.uid()
  );

-- Company Admins can update all tasks in their company
DROP POLICY IF EXISTS "Company Admins can update company tasks" ON tasks;
CREATE POLICY "Company Admins can update company tasks"
  ON tasks FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid())
  )
  WITH CHECK (
    status = true AND
    public.is_company_admin(auth.uid())
  );

-- Company Admins can delete tasks in their company (soft delete)
DROP POLICY IF EXISTS "Company Admins can delete company tasks" ON tasks;
CREATE POLICY "Company Admins can delete company tasks"
  ON tasks FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid())
  );

-- ============================================
-- INCIDENTS TABLE POLICIES
-- ============================================

-- Users can view incidents they reported
DROP POLICY IF EXISTS "Users can view reported incidents" ON incidents;
CREATE POLICY "Users can view reported incidents"
  ON incidents FOR SELECT
  USING (
    status = true AND (
      reported_by = auth.uid() OR
      public.is_root(auth.uid()) OR
      (
        public.is_company_admin(auth.uid()) AND
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = reported_by
            AND p.company_id = public.get_user_company_id(auth.uid())
        )
      )
    )
  );

-- All authenticated users can report incidents
DROP POLICY IF EXISTS "Authenticated users can create incidents" ON incidents;
CREATE POLICY "Authenticated users can create incidents"
  ON incidents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Company Admins can update incidents in their company
DROP POLICY IF EXISTS "Company Admins can update company incidents" ON incidents;
CREATE POLICY "Company Admins can update company incidents"
  ON incidents FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = reported_by
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  )
  WITH CHECK (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = reported_by
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Company Admins can delete incidents in their company (soft delete)
DROP POLICY IF EXISTS "Company Admins can delete company incidents" ON incidents;
CREATE POLICY "Company Admins can delete company incidents"
  ON incidents FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = reported_by
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = reported_by
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- ============================================
-- CLAIMS TABLE POLICIES
-- ============================================

-- Members can view their own claims
DROP POLICY IF EXISTS "Members can view own claims" ON claims;
CREATE POLICY "Members can view own claims"
  ON claims FOR SELECT
  USING (
    status = true AND (
      customer_id = auth.uid() OR
      public.booking_belongs_to_user_company(customer_id, auth.uid())
    )
  );

-- Company Admins can view all claims in their company
DROP POLICY IF EXISTS "Company Admins can view company claims" ON claims;
CREATE POLICY "Company Admins can view company claims"
  ON claims FOR SELECT
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Members can create claims
DROP POLICY IF EXISTS "Members can create own claims" ON claims;
CREATE POLICY "Members can create own claims"
  ON claims FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Members can update their own pending claims
DROP POLICY IF EXISTS "Members can update own claims" ON claims;
CREATE POLICY "Members can update own claims"
  ON claims FOR UPDATE
  USING (
    status = true AND
    customer_id = auth.uid() AND claim_status = 'submitted'
  )
  WITH CHECK (
    status = true AND
    customer_id = auth.uid() AND claim_status = 'submitted'
  );

-- Company Admins can update claims in their company
DROP POLICY IF EXISTS "Company Admins can update company claims" ON claims;
CREATE POLICY "Company Admins can update company claims"
  ON claims FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can delete claims in their company (soft delete)
DROP POLICY IF EXISTS "Company Admins can delete company claims" ON claims;
CREATE POLICY "Company Admins can delete company claims"
  ON claims FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- ============================================
-- NOTIFICATIONS TABLE POLICIES
-- ============================================

-- Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (
    status = true AND user_id = auth.uid()
  );

-- Users can update their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (
    status = true AND user_id = auth.uid()
  )
  WITH CHECK (
    status = true AND user_id = auth.uid()
  );

-- System can create notifications
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can delete their own notifications (soft delete)
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR UPDATE
  USING (
    status = true AND user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- ============================================
-- WORKER SHIFTS TABLE POLICIES
-- ============================================

-- Workers can view their own shifts
DROP POLICY IF EXISTS "Workers can view own shifts" ON worker_shifts;
CREATE POLICY "Workers can view own shifts"
  ON worker_shifts FOR SELECT
  USING (
    status = true AND worker_id = auth.uid()
  );

-- Company Admins can view shifts in their company
DROP POLICY IF EXISTS "Company Admins can view company shifts" ON worker_shifts;
CREATE POLICY "Company Admins can view company shifts"
  ON worker_shifts FOR SELECT
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = worker_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Workers can create their own shifts
DROP POLICY IF EXISTS "Workers can create own shifts" ON worker_shifts;
CREATE POLICY "Workers can create own shifts"
  ON worker_shifts FOR INSERT
  WITH CHECK (worker_id = auth.uid());

-- Workers can update their own shifts
DROP POLICY IF EXISTS "Workers can update own shifts" ON worker_shifts;
CREATE POLICY "Workers can update own shifts"
  ON worker_shifts FOR UPDATE
  USING (
    status = true AND worker_id = auth.uid()
  )
  WITH CHECK (
    status = true AND worker_id = auth.uid()
  );

-- Company Admins can update shifts in their company
DROP POLICY IF EXISTS "Company Admins can update company shifts" ON worker_shifts;
CREATE POLICY "Company Admins can update company shifts"
  ON worker_shifts FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = worker_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  )
  WITH CHECK (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = worker_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- Company Admins can delete shifts in their company (soft delete)
DROP POLICY IF EXISTS "Company Admins can delete company shifts" ON worker_shifts;
CREATE POLICY "Company Admins can delete company shifts"
  ON worker_shifts FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = worker_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = worker_id
        AND p.company_id = public.get_user_company_id(auth.uid())
    )
  );

-- ============================================
-- COMPANIES TABLE POLICIES
-- ============================================

-- Users can view companies
DROP POLICY IF EXISTS "Users can view companies" ON companies;
CREATE POLICY "Users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (status = true);

-- Users can create companies
DROP POLICY IF EXISTS "Users can create companies" ON companies;
CREATE POLICY "Users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Company Admins can update their own company
DROP POLICY IF EXISTS "Users can update companies" ON companies;
CREATE POLICY "Company Admins can update own company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    status = true AND (
      public.is_company_admin(auth.uid()) AND
      id = public.get_user_company_id(auth.uid())
    )
  )
  WITH CHECK (
    status = true AND (
      public.is_company_admin(auth.uid()) AND
      id = public.get_user_company_id(auth.uid())
    )
  );

-- Company Admins can delete their own company (soft delete)
DROP POLICY IF EXISTS "Company Admins can delete own company" ON companies;
CREATE POLICY "Company Admins can delete own company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    id = public.get_user_company_id(auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    id = public.get_user_company_id(auth.uid())
  );

-- ============================================
-- WAREHOUSES TABLE POLICIES
-- ============================================

-- Users can view warehouses
DROP POLICY IF EXISTS "Users can view warehouses" ON warehouses;
CREATE POLICY "Users can view warehouses"
  ON warehouses FOR SELECT
  TO authenticated
  USING (status = true);

-- Company Admins can create warehouses for their company
DROP POLICY IF EXISTS "Company Admins can create warehouses" ON warehouses;
CREATE POLICY "Company Admins can create warehouses"
  ON warehouses FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_company_admin(auth.uid())
  );

-- Company Admins can update warehouses in their company
DROP POLICY IF EXISTS "Company Admins can update company warehouses" ON warehouses;
CREATE POLICY "Company Admins can update company warehouses"
  ON warehouses FOR UPDATE
  TO authenticated
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    owner_company_id = public.get_user_company_id(auth.uid())
  )
  WITH CHECK (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    owner_company_id = public.get_user_company_id(auth.uid())
  );

-- Company Admins can delete warehouses in their company (soft delete)
DROP POLICY IF EXISTS "Company Admins can delete company warehouses" ON warehouses;
CREATE POLICY "Company Admins can delete company warehouses"
  ON warehouses FOR UPDATE
  TO authenticated
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    owner_company_id = public.get_user_company_id(auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    owner_company_id = public.get_user_company_id(auth.uid())
  );

-- ============================================
-- SERVICE ORDERS TABLE POLICIES
-- ============================================

-- Members can view their own service orders
DROP POLICY IF EXISTS "Members can view own service orders" ON service_orders;
CREATE POLICY "Members can view own service orders"
  ON service_orders FOR SELECT
  USING (
    status = true AND (
      customer_id = auth.uid() OR
      public.booking_belongs_to_user_company(customer_id, auth.uid())
    )
  );

-- Company Admins can view all service orders in their company
DROP POLICY IF EXISTS "Company Admins can view company service orders" ON service_orders;
CREATE POLICY "Company Admins can view company service orders"
  ON service_orders FOR SELECT
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Members can create service orders
DROP POLICY IF EXISTS "Members can create service orders" ON service_orders;
CREATE POLICY "Members can create service orders"
  ON service_orders FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Company Admins can update service orders in their company
DROP POLICY IF EXISTS "Company Admins can update company service orders" ON service_orders;
CREATE POLICY "Company Admins can update company service orders"
  ON service_orders FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can delete service orders in their company (soft delete)
DROP POLICY IF EXISTS "Company Admins can delete company service orders" ON service_orders;
CREATE POLICY "Company Admins can delete company service orders"
  ON service_orders FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- ============================================
-- PAYMENTS TABLE POLICIES
-- ============================================

-- Members can view their own payments
DROP POLICY IF EXISTS "Members can view own payments" ON payments;
CREATE POLICY "Members can view own payments"
  ON payments FOR SELECT
  USING (
    status = true AND (
      customer_id = auth.uid() OR
      public.booking_belongs_to_user_company(customer_id, auth.uid())
    )
  );

-- Company Admins can view all payments in their company
DROP POLICY IF EXISTS "Company Admins can view company payments" ON payments;
CREATE POLICY "Company Admins can view company payments"
  ON payments FOR SELECT
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Members can create payments
DROP POLICY IF EXISTS "Members can create payments" ON payments;
CREATE POLICY "Members can create payments"
  ON payments FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Company Admins can update payments in their company
DROP POLICY IF EXISTS "Company Admins can update company payments" ON payments;
CREATE POLICY "Company Admins can update company payments"
  ON payments FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- Company Admins can delete payments in their company (soft delete)
DROP POLICY IF EXISTS "Company Admins can delete company payments" ON payments;
CREATE POLICY "Company Admins can delete company payments"
  ON payments FOR UPDATE
  USING (
    status = true AND
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  )
  WITH CHECK (
    public.is_company_admin(auth.uid()) AND
    public.booking_belongs_to_user_company(customer_id, auth.uid())
  );

-- ============================================
-- WAREHOUSE SERVICES TABLE POLICIES
-- ============================================

-- All users can view active warehouse services
DROP POLICY IF EXISTS "Users can view warehouse services" ON warehouse_services;
CREATE POLICY "Users can view warehouse services"
  ON warehouse_services FOR SELECT
  TO authenticated
  USING (status = true AND is_active = true);

-- Root can manage warehouse services
DROP POLICY IF EXISTS "Root can manage warehouse services" ON warehouse_services;
CREATE POLICY "Root can manage warehouse services"
  ON warehouse_services FOR ALL
  TO authenticated
  USING (
    status = true AND public.is_root(auth.uid())
  )
  WITH CHECK (
    status = true AND public.is_root(auth.uid())
  );

-- Root can delete warehouse services (soft delete)
DROP POLICY IF EXISTS "Root can delete warehouse services" ON warehouse_services;
CREATE POLICY "Root can delete warehouse services"
  ON warehouse_services FOR UPDATE
  TO authenticated
  USING (
    status = true AND public.is_root(auth.uid())
  )
  WITH CHECK (
    public.is_root(auth.uid())
  );

-- ============================================
-- NOTE: Additional tables will need similar updates
-- This migration covers the main tables. Other tables should follow the same pattern:
-- 1. Add status = true to SELECT policies
-- 2. Add status = true to UPDATE policies USING clause
-- 3. Convert DELETE policies to UPDATE policies that set status = false
-- ============================================

COMMENT ON COLUMN profiles.status IS 'Soft delete flag: true = not deleted, false = deleted. All RLS policies filter by status = true';

