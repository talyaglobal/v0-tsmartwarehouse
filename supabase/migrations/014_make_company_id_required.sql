-- Make company_id required in profiles table
-- First, ensure all existing profiles have a company_id
-- If not, create a default company for them

DO $$
DECLARE
  profile_record RECORD;
  default_company_id UUID;
BEGIN
  -- Check if there are profiles without company_id
  FOR profile_record IN 
    SELECT id, email, name
    FROM profiles 
    WHERE company_id IS NULL
  LOOP
    -- Create a default company for this profile
    INSERT INTO companies (name)
    VALUES (COALESCE(profile_record.name || '''s Company', 'Company for ' || profile_record.email))
    RETURNING id INTO default_company_id;
    
    -- Update profile with the new company_id
    UPDATE profiles
    SET company_id = default_company_id
    WHERE id = profile_record.id;
  END LOOP;
END $$;

-- Now make company_id NOT NULL
ALTER TABLE profiles 
ALTER COLUMN company_id SET NOT NULL;

