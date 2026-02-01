-- Migration: RLS Policies for client_teams, client_team_members, and booking_approvals
-- Created: 2026-01-29
-- Purpose: Secure access control for new client/team related tables
--
-- This migration:
-- 1. RLS policies for client_teams table
-- 2. RLS policies for client_team_members table
-- 3. RLS policies for booking_approvals table
-- 4. Updates booking RLS policies for on-behalf bookings

-- =====================================================
-- PART 1: RLS POLICIES FOR CLIENT_TEAMS
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view teams in their company" ON client_teams;
DROP POLICY IF EXISTS "Team admins and company admins can create teams" ON client_teams;
DROP POLICY IF EXISTS "Team admins can update their teams" ON client_teams;
DROP POLICY IF EXISTS "Team admins can delete their teams" ON client_teams;
DROP POLICY IF EXISTS "Root can manage all teams" ON client_teams;

-- Users can view teams in their company
CREATE POLICY "Users can view teams in their company"
ON client_teams FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'root'
  )
);

-- Company admins and corporate users can create teams
CREATE POLICY "Corporate users can create teams"
ON client_teams FOR INSERT
TO authenticated
WITH CHECK (
  -- User must be in the same company
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid() AND client_type = 'corporate'
  )
  AND created_by = auth.uid()
);

-- Team admins and company admins can update teams
CREATE POLICY "Team admins can update their teams"
ON client_teams FOR UPDATE
TO authenticated
USING (
  -- User is a team admin
  EXISTS (
    SELECT 1 FROM client_team_members
    WHERE team_id = client_teams.id
    AND member_id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- User is root
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'root'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_team_members
    WHERE team_id = client_teams.id
    AND member_id = auth.uid()
    AND role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'root'
  )
);

-- Team admins can soft delete their teams
CREATE POLICY "Team admins can delete their teams"
ON client_teams FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_team_members
    WHERE team_id = client_teams.id
    AND member_id = auth.uid()
    AND role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'root'
  )
);

-- =====================================================
-- PART 2: RLS POLICIES FOR CLIENT_TEAM_MEMBERS
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view members of their teams" ON client_team_members;
DROP POLICY IF EXISTS "Team admins can add members" ON client_team_members;
DROP POLICY IF EXISTS "Team admins can update member roles" ON client_team_members;
DROP POLICY IF EXISTS "Team admins can remove members" ON client_team_members;
DROP POLICY IF EXISTS "Users can leave teams" ON client_team_members;

-- Users can view members of teams they belong to
CREATE POLICY "Users can view members of their teams"
ON client_team_members FOR SELECT
TO authenticated
USING (
  -- User is a member of this team
  team_id IN (
    SELECT team_id FROM client_team_members WHERE member_id = auth.uid()
  )
  OR
  -- User is root
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'root'
  )
);

-- Team admins can add new members
CREATE POLICY "Team admins can add members"
ON client_team_members FOR INSERT
TO authenticated
WITH CHECK (
  -- User is an admin of this team
  EXISTS (
    SELECT 1 FROM client_team_members
    WHERE team_id = client_team_members.team_id
    AND member_id = auth.uid()
    AND role = 'admin'
  )
  AND invited_by = auth.uid()
);

-- Team admins can update member roles
CREATE POLICY "Team admins can update member roles"
ON client_team_members FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM client_team_members admin_check
    WHERE admin_check.team_id = client_team_members.team_id
    AND admin_check.member_id = auth.uid()
    AND admin_check.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM client_team_members admin_check
    WHERE admin_check.team_id = client_team_members.team_id
    AND admin_check.member_id = auth.uid()
    AND admin_check.role = 'admin'
  )
);

-- Team admins can remove members, users can remove themselves
CREATE POLICY "Team admins can remove members or self leave"
ON client_team_members FOR DELETE
TO authenticated
USING (
  -- User is an admin of this team
  EXISTS (
    SELECT 1 FROM client_team_members admin_check
    WHERE admin_check.team_id = client_team_members.team_id
    AND admin_check.member_id = auth.uid()
    AND admin_check.role = 'admin'
  )
  OR
  -- User is removing themselves
  member_id = auth.uid()
);

-- =====================================================
-- PART 3: RLS POLICIES FOR BOOKING_APPROVALS
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their approval requests" ON booking_approvals;
DROP POLICY IF EXISTS "Team admins can create approval requests" ON booking_approvals;
DROP POLICY IF EXISTS "Customers can respond to approval requests" ON booking_approvals;

-- Users can view approval requests they created or are for their bookings
CREATE POLICY "Users can view their approval requests"
ON booking_approvals FOR SELECT
TO authenticated
USING (
  -- User is the requester
  requested_by = auth.uid()
  OR
  -- User is the booking customer (responder)
  booking_id IN (
    SELECT id FROM bookings WHERE customer_id = auth.uid()
  )
  OR
  -- User is root
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'root'
  )
);

-- Team admins can create approval requests (via function, but direct insert allowed)
CREATE POLICY "Team admins can create approval requests"
ON booking_approvals FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
);

-- Only customers can update approval requests (to approve/reject)
CREATE POLICY "Customers can respond to approval requests"
ON booking_approvals FOR UPDATE
TO authenticated
USING (
  -- User is the booking customer
  booking_id IN (
    SELECT id FROM bookings WHERE customer_id = auth.uid()
  )
)
WITH CHECK (
  booking_id IN (
    SELECT id FROM bookings WHERE customer_id = auth.uid()
  )
);

-- =====================================================
-- PART 4: UPDATE BOOKINGS POLICIES FOR ON-BEHALF
-- =====================================================

-- Allow team admins to view bookings they made on behalf of others
DROP POLICY IF EXISTS "Users can view bookings they created on behalf" ON bookings;

CREATE POLICY "Users can view bookings they created on behalf"
ON bookings FOR SELECT
TO authenticated
USING (
  booked_by_id = auth.uid()
);

-- Allow team admins to create bookings on behalf of team members
DROP POLICY IF EXISTS "Team admins can create bookings on behalf" ON bookings;

-- Note: The actual booking creation check should verify team membership
-- This is a simplified policy; additional validation should be done in application logic
CREATE POLICY "Team admins can create bookings on behalf"
ON bookings FOR INSERT
TO authenticated
WITH CHECK (
  -- Regular booking (user booking for themselves)
  (customer_id = auth.uid() AND (booked_by_id IS NULL OR booked_by_id = auth.uid()))
  OR
  -- On-behalf booking (team admin booking for team member)
  (
    booked_by_id = auth.uid()
    AND booked_on_behalf = true
    AND EXISTS (
      SELECT 1 FROM client_team_members tm1
      JOIN client_team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.member_id = auth.uid()
      AND tm1.role = 'admin'
      AND tm2.member_id = customer_id
    )
  )
);

-- =====================================================
-- PART 5: HELPER FUNCTION TO VALIDATE ON-BEHALF BOOKING
-- =====================================================

-- Function to validate if a user can book on behalf of another user
CREATE OR REPLACE FUNCTION can_book_on_behalf(p_booker_id UUID, p_customer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if booker is a team admin and customer is in the same team
  RETURN EXISTS (
    SELECT 1 FROM client_team_members tm1
    JOIN client_team_members tm2 ON tm1.team_id = tm2.team_id
    JOIN client_teams ct ON tm1.team_id = ct.id
    WHERE tm1.member_id = p_booker_id
    AND tm1.role = 'admin'
    AND tm2.member_id = p_customer_id
    AND ct.status = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_book_on_behalf IS 'Check if a user (team admin) can book on behalf of another user (team member)';

