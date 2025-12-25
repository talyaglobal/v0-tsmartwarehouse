-- Add consistency check between profiles.company_id and company_members
-- Ensure that if a user has a company_id in profiles, they should have a corresponding entry in company_members

-- Create a function to check and fix inconsistencies
CREATE OR REPLACE FUNCTION public.ensure_company_member_consistency()
RETURNS TRIGGER AS $$
DECLARE
  _company_id UUID;
  _existing_member RECORD;
BEGIN
  -- Get the company_id from the profile
  _company_id := NEW.company_id;
  
  -- If company_id is set, ensure there's a corresponding company_members entry
  IF _company_id IS NOT NULL THEN
    -- Check if company_members entry exists
    SELECT * INTO _existing_member
    FROM company_members
    WHERE user_id = NEW.id
      AND company_id = _company_id
      AND status = 'active';
    
    -- If no active member entry exists, create one with 'member' role
    -- (This is a fallback - the registration process should create it with proper role)
    IF _existing_member IS NULL THEN
      INSERT INTO company_members (company_id, user_id, role, status, joined_at)
      VALUES (_company_id, NEW.id, 'member', 'active', NOW())
      ON CONFLICT (company_id, user_id) DO UPDATE SET
        status = 'active',
        joined_at = COALESCE(company_members.joined_at, NOW());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to ensure consistency when profile is updated
DROP TRIGGER IF EXISTS ensure_company_member_on_profile_update ON profiles;
CREATE TRIGGER ensure_company_member_on_profile_update
  AFTER UPDATE OF company_id ON profiles
  FOR EACH ROW
  WHEN (NEW.company_id IS DISTINCT FROM OLD.company_id)
  EXECUTE FUNCTION public.ensure_company_member_consistency();

-- Also create trigger for INSERT (in case profile is created without company_members)
DROP TRIGGER IF EXISTS ensure_company_member_on_profile_insert ON profiles;
CREATE TRIGGER ensure_company_member_on_profile_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.company_id IS NOT NULL)
  EXECUTE FUNCTION public.ensure_company_member_consistency();

-- Fix any existing inconsistencies
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  -- For each profile with company_id but no active company_members entry
  FOR profile_record IN
    SELECT p.id, p.company_id
    FROM profiles p
    WHERE p.company_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.user_id = p.id
          AND cm.company_id = p.company_id
          AND cm.status = 'active'
      )
  LOOP
    -- Create company_members entry with 'member' role
    -- Note: This is a fallback - actual role should be set during registration
    INSERT INTO company_members (company_id, user_id, role, status, joined_at)
    VALUES (profile_record.company_id, profile_record.id, 'member', 'active', NOW())
    ON CONFLICT (company_id, user_id) DO UPDATE SET
      status = 'active',
      joined_at = COALESCE(company_members.joined_at, NOW());
  END LOOP;
END $$;

