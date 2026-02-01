-- Migration: Create client_teams and client_team_members tables
-- Created: 2026-01-29
-- Purpose: Enable team structure for corporate clients
--
-- This migration:
-- 1. Creates client_teams table for corporate client teams
-- 2. Creates client_team_members table for team membership
-- 3. Adds team_id reference to profiles table
-- 4. Creates necessary indexes and triggers

-- =====================================================
-- PART 1: CREATE CLIENT_TEAMS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS client_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each team name must be unique within a company
  UNIQUE(company_id, name)
);

-- Enable RLS
ALTER TABLE client_teams ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_teams_company_id ON client_teams(company_id);
CREATE INDEX IF NOT EXISTS idx_client_teams_created_by ON client_teams(created_by);
CREATE INDEX IF NOT EXISTS idx_client_teams_status ON client_teams(status) WHERE status = true;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_client_teams_updated_at ON client_teams;
CREATE TRIGGER update_client_teams_updated_at
  BEFORE UPDATE ON client_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE client_teams IS 'Teams within corporate client companies for organizing bookings and permissions';
COMMENT ON COLUMN client_teams.company_id IS 'The company this team belongs to';
COMMENT ON COLUMN client_teams.name IS 'Team name (unique within company)';
COMMENT ON COLUMN client_teams.status IS 'Soft delete flag: true = active, false = deleted';

-- =====================================================
-- PART 2: CREATE CLIENT_TEAM_MEMBERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS client_team_members (
  team_id UUID NOT NULL REFERENCES client_teams(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Composite primary key
  PRIMARY KEY (team_id, member_id),
  
  -- Role constraint
  CONSTRAINT client_team_members_role_check CHECK (role IN ('admin', 'member'))
);

-- Enable RLS
ALTER TABLE client_team_members ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_team_members_team_id ON client_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_client_team_members_member_id ON client_team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_client_team_members_role ON client_team_members(role);
CREATE INDEX IF NOT EXISTS idx_client_team_members_invited_by ON client_team_members(invited_by);

-- Comments
COMMENT ON TABLE client_team_members IS 'Team membership for corporate clients with role-based permissions';
COMMENT ON COLUMN client_team_members.role IS 'Member role: admin (can manage team and book on behalf) or member (regular team member)';

-- =====================================================
-- PART 3: ADD TEAM_ID TO PROFILES (Optional quick lookup)
-- =====================================================

-- Add default_team_id for quick team lookup (user can be in multiple teams, this is their primary)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS default_team_id UUID REFERENCES client_teams(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_profiles_default_team_id ON profiles(default_team_id);

-- Comment
COMMENT ON COLUMN profiles.default_team_id IS 'User''s primary/default team for quick lookups';

-- =====================================================
-- PART 4: HELPER FUNCTIONS
-- =====================================================

-- Function to check if a user is a team admin
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user is in the same team as another user
CREATE OR REPLACE FUNCTION are_users_in_same_team(p_user_id_1 UUID, p_user_id_2 UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM client_team_members tm1
    JOIN client_team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.member_id = p_user_id_1
    AND tm2.member_id = p_user_id_2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's teams
CREATE OR REPLACE FUNCTION get_user_teams(p_user_id UUID)
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  company_id UUID,
  user_role TEXT,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.id AS team_id,
    ct.name AS team_name,
    ct.company_id,
    ctm.role AS user_role,
    (SELECT COUNT(*) FROM client_team_members WHERE team_id = ct.id) AS member_count
  FROM client_teams ct
  JOIN client_team_members ctm ON ct.id = ctm.team_id
  WHERE ctm.member_id = p_user_id
  AND ct.status = true
  ORDER BY ct.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team members that a user can book on behalf of
CREATE OR REPLACE FUNCTION get_team_members_for_booking(p_user_id UUID)
RETURNS TABLE (
  member_id UUID,
  member_name TEXT,
  member_email TEXT,
  team_id UUID,
  team_name TEXT
) AS $$
BEGIN
  -- Only team admins can book on behalf of others
  RETURN QUERY
  SELECT DISTINCT
    p.id AS member_id,
    p.name AS member_name,
    p.email AS member_email,
    ct.id AS team_id,
    ct.name AS team_name
  FROM client_teams ct
  JOIN client_team_members admin_tm ON ct.id = admin_tm.team_id
  JOIN client_team_members member_tm ON ct.id = member_tm.team_id
  JOIN profiles p ON member_tm.member_id = p.id
  WHERE admin_tm.member_id = p_user_id
  AND admin_tm.role = 'admin'
  AND ct.status = true
  AND p.id != p_user_id  -- Exclude self
  ORDER BY ct.name, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

