-- Migration: Fix infinite recursion in client_team_members RLS policies
-- Created: 2026-01-29
-- Purpose: Rewrite RLS policies to avoid self-referencing queries
--
-- The original policies caused infinite recursion because they queried
-- client_team_members to determine access to client_team_members.
-- This migration fixes the issue by using SECURITY DEFINER functions.

-- =====================================================
-- PART 1: CREATE HELPER FUNCTIONS (SECURITY DEFINER)
-- =====================================================

-- Function to check if user is a member of a team (bypasses RLS)
CREATE OR REPLACE FUNCTION is_team_member(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM client_team_members
    WHERE team_id = p_team_id
    AND member_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is admin of a team (bypasses RLS)
CREATE OR REPLACE FUNCTION is_team_admin(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM client_team_members
    WHERE team_id = p_team_id
    AND member_id = p_user_id
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get all team IDs a user belongs to (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_team_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
  RETURN QUERY
  SELECT team_id FROM client_team_members WHERE member_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is root
CREATE OR REPLACE FUNCTION is_root_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'root'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- PART 2: DROP OLD CLIENT_TEAM_MEMBERS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view members of their teams" ON client_team_members;
DROP POLICY IF EXISTS "Team admins can add members" ON client_team_members;
DROP POLICY IF EXISTS "Team admins can update member roles" ON client_team_members;
DROP POLICY IF EXISTS "Team admins can remove members or self leave" ON client_team_members;
DROP POLICY IF EXISTS "Users can leave teams" ON client_team_members;

-- =====================================================
-- PART 3: CREATE NEW CLIENT_TEAM_MEMBERS POLICIES
-- =====================================================

-- Users can view members of teams they belong to
CREATE POLICY "Users can view members of their teams"
ON client_team_members FOR SELECT
TO authenticated
USING (
  -- User is a member of this team (using SECURITY DEFINER function)
  is_team_member(team_id, auth.uid())
  OR
  -- User is root
  is_root_user(auth.uid())
);

-- Team admins can add new members
CREATE POLICY "Team admins can add members"
ON client_team_members FOR INSERT
TO authenticated
WITH CHECK (
  -- User is an admin of this team (using SECURITY DEFINER function)
  is_team_admin(team_id, auth.uid())
  AND invited_by = auth.uid()
);

-- Team admins can update member roles
CREATE POLICY "Team admins can update member roles"
ON client_team_members FOR UPDATE
TO authenticated
USING (
  is_team_admin(team_id, auth.uid())
)
WITH CHECK (
  is_team_admin(team_id, auth.uid())
);

-- Team admins can remove members, users can remove themselves
CREATE POLICY "Team admins can remove members or self leave"
ON client_team_members FOR DELETE
TO authenticated
USING (
  -- User is an admin of this team
  is_team_admin(team_id, auth.uid())
  OR
  -- User is removing themselves
  member_id = auth.uid()
);

-- =====================================================
-- PART 4: UPDATE CLIENT_TEAMS POLICIES TO USE FUNCTIONS
-- =====================================================

-- Drop and recreate client_teams policies to use the new functions
DROP POLICY IF EXISTS "Team admins can update their teams" ON client_teams;
DROP POLICY IF EXISTS "Team admins can delete their teams" ON client_teams;

-- Team admins can update their teams
CREATE POLICY "Team admins can update their teams"
ON client_teams FOR UPDATE
TO authenticated
USING (
  is_team_admin(id, auth.uid())
  OR
  is_root_user(auth.uid())
)
WITH CHECK (
  is_team_admin(id, auth.uid())
  OR
  is_root_user(auth.uid())
);

-- Team admins can delete their teams
CREATE POLICY "Team admins can delete their teams"
ON client_teams FOR DELETE
TO authenticated
USING (
  is_team_admin(id, auth.uid())
  OR
  is_root_user(auth.uid())
);

-- =====================================================
-- PART 5: UPDATE BOOKINGS POLICY TO USE FUNCTION
-- =====================================================

DROP POLICY IF EXISTS "Team admins can create bookings on behalf" ON bookings;

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
    AND can_book_on_behalf(auth.uid(), customer_id)
  )
);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION is_team_member IS 'Check if a user is a member of a specific team (SECURITY DEFINER to bypass RLS)';
COMMENT ON FUNCTION is_team_admin IS 'Check if a user is an admin of a specific team (SECURITY DEFINER to bypass RLS)';
COMMENT ON FUNCTION get_user_team_ids IS 'Get all team IDs a user belongs to (SECURITY DEFINER to bypass RLS)';
COMMENT ON FUNCTION is_root_user IS 'Check if a user has root role (SECURITY DEFINER to bypass RLS)';
