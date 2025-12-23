-- Add company_id to profiles table
-- This links profiles to companies

-- Add company_id column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS profiles_company_id_idx ON profiles(company_id);

-- Update existing profiles: if company field exists, try to find or create company
DO $$
DECLARE
  profile_record RECORD;
  company_record RECORD;
  new_company_id UUID;
BEGIN
  -- Loop through profiles that have a company name but no company_id
  FOR profile_record IN 
    SELECT id, company 
    FROM profiles 
    WHERE company IS NOT NULL 
      AND company != '' 
      AND company_id IS NULL
  LOOP
    -- Try to find existing company with same name
    SELECT id INTO company_record
    FROM companies
    WHERE name = profile_record.company
    LIMIT 1;
    
    IF company_record IS NULL THEN
      -- Create new company
      INSERT INTO companies (name)
      VALUES (profile_record.company)
      RETURNING id INTO new_company_id;
      
      -- Update profile with new company_id
      UPDATE profiles
      SET company_id = new_company_id
      WHERE id = profile_record.id;
    ELSE
      -- Use existing company
      UPDATE profiles
      SET company_id = company_record.id
      WHERE id = profile_record.id;
    END IF;
  END LOOP;
END $$;

