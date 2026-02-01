-- Migration: Add is_default flag to client_teams
-- Created: 2026-02-01
-- Purpose: Mark default teams that cannot be deleted

-- =====================================================
-- PART 1: ADD IS_DEFAULT COLUMN
-- =====================================================

ALTER TABLE client_teams
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create index for default team queries
CREATE INDEX IF NOT EXISTS idx_client_teams_is_default 
ON client_teams(company_id, is_default) 
WHERE is_default = true;

-- =====================================================
-- PART 2: CREATE FUNCTION TO PREVENT DEFAULT TEAM DELETION
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_default_team_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_default = true THEN
    RAISE EXCEPTION 'Cannot delete the default team. You can only rename it.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent deletion of default teams
DROP TRIGGER IF EXISTS trigger_prevent_default_team_delete ON client_teams;
CREATE TRIGGER trigger_prevent_default_team_delete
  BEFORE DELETE ON client_teams
  FOR EACH ROW
  EXECUTE FUNCTION prevent_default_team_deletion();

-- =====================================================
-- PART 3: CREATE FUNCTION TO PREVENT IS_DEFAULT UPDATE
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_default_flag_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent changing is_default from true to false
  IF OLD.is_default = true AND NEW.is_default = false THEN
    RAISE EXCEPTION 'Cannot remove default flag from the default team.';
  END IF;
  
  -- Prevent setting is_default to true if company already has a default team
  IF NEW.is_default = true AND OLD.is_default = false THEN
    IF EXISTS (
      SELECT 1 FROM client_teams 
      WHERE company_id = NEW.company_id 
      AND is_default = true 
      AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Company already has a default team.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to protect is_default flag
DROP TRIGGER IF EXISTS trigger_protect_default_flag ON client_teams;
CREATE TRIGGER trigger_protect_default_flag
  BEFORE UPDATE ON client_teams
  FOR EACH ROW
  EXECUTE FUNCTION prevent_default_flag_change();

-- =====================================================
-- PART 4: MARK EXISTING FIRST TEAMS AS DEFAULT
-- =====================================================

-- For each company, mark the oldest team as default if no default exists
WITH first_teams AS (
  SELECT DISTINCT ON (company_id) id, company_id
  FROM client_teams
  WHERE status = true
  ORDER BY company_id, created_at ASC
)
UPDATE client_teams ct
SET is_default = true
FROM first_teams ft
WHERE ct.id = ft.id
AND NOT EXISTS (
  SELECT 1 FROM client_teams 
  WHERE company_id = ct.company_id 
  AND is_default = true
);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN client_teams.is_default IS 'Default team for the company. Cannot be deleted, only renamed. Each company should have exactly one default team.';

COMMENT ON FUNCTION prevent_default_team_deletion() IS 'Prevents deletion of default teams. Users can only rename them.';

COMMENT ON FUNCTION prevent_default_flag_change() IS 'Prevents removal of default flag and ensures only one default team per company.';
