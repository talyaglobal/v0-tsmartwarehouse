-- Set company creators as owners
-- This migration identifies the creator of each company (earliest member)
-- and sets them as 'owner' in the company_members table
-- Also ensures profiles.company_id is synchronized for consistency
--
-- Strategy:
-- 1. For each company, find the earliest member (by joined_at or created_at)
-- 2. If no company_members entry exists, use the earliest profile with that company_id
-- 3. Set that user as 'owner' role in company_members
-- 4. Update profiles.company_id to ensure consistency

DO $$
DECLARE
  company_record RECORD;
  creator_user_id UUID;
  creator_joined_at TIMESTAMPTZ;
  existing_member RECORD;
  updated_count INTEGER := 0;
  created_count INTEGER := 0;
BEGIN
  -- Loop through all companies
  FOR company_record IN
    SELECT id, name, created_at
    FROM companies
    ORDER BY created_at
  LOOP
    -- Find the earliest company_members entry for this company
    SELECT user_id, COALESCE(joined_at, created_at) as join_date
    INTO existing_member
    FROM company_members
    WHERE company_id = company_record.id
      AND status = 'active'
    ORDER BY COALESCE(joined_at, created_at) ASC
    LIMIT 1;
    
    -- If no company_members entry exists, find earliest profile with this company_id
    IF existing_member IS NULL THEN
      SELECT id, created_at
      INTO creator_user_id, creator_joined_at
      FROM profiles
      WHERE company_id = company_record.id
      ORDER BY created_at ASC
      LIMIT 1;
      
      -- If we found a profile, create company_members entry with 'owner' role
      IF creator_user_id IS NOT NULL THEN
        INSERT INTO company_members (company_id, user_id, role, status, joined_at, created_at)
        VALUES (
          company_record.id,
          creator_user_id,
          'owner',
          'active',
          creator_joined_at,
          creator_joined_at
        )
        ON CONFLICT (company_id, user_id) DO UPDATE SET
          role = 'owner',
          status = 'active',
          joined_at = COALESCE(company_members.joined_at, creator_joined_at);
        
        -- Ensure profiles.company_id is set for consistency
        UPDATE profiles
        SET company_id = company_record.id
        WHERE id = creator_user_id
          AND (company_id IS NULL OR company_id != company_record.id);
        
        created_count := created_count + 1;
        RAISE NOTICE 'Created owner entry for company % (%), user %', 
          company_record.name, company_record.id, creator_user_id;
      ELSE
        RAISE NOTICE 'WARNING: No members found for company % (%)', 
          company_record.name, company_record.id;
      END IF;
    ELSE
      -- Update existing member to 'owner' if they're not already owner
      IF existing_member.user_id IS NOT NULL THEN
        UPDATE company_members
        SET role = 'owner',
            status = 'active'
        WHERE company_id = company_record.id
          AND user_id = existing_member.user_id
          AND role != 'owner';
        
        IF FOUND THEN
          updated_count := updated_count + 1;
          RAISE NOTICE 'Updated user % to owner for company % (%)', 
            existing_member.user_id, company_record.name, company_record.id;
        ELSE
          RAISE NOTICE 'User % is already owner for company % (%)', 
            existing_member.user_id, company_record.name, company_record.id;
        END IF;
        
        -- Ensure profiles.company_id is set for consistency
        UPDATE profiles
        SET company_id = company_record.id
        WHERE id = existing_member.user_id
          AND (company_id IS NULL OR company_id != company_record.id);
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration completed: % owners created, % owners updated', 
    created_count, updated_count;
END $$;

-- Verify the results
DO $$
DECLARE
  company_without_owner RECORD;
  owner_count INTEGER;
BEGIN
  -- Check if all companies have at least one owner
  FOR company_without_owner IN
    SELECT c.id, c.name
    FROM companies c
    WHERE NOT EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = c.id
      AND cm.role = 'owner'
      AND cm.status = 'active'
    )
  LOOP
    RAISE WARNING 'Company % (%) has no owner!', 
      company_without_owner.name, company_without_owner.id;
  END LOOP;
  
  -- Count total owners
  SELECT COUNT(*) INTO owner_count
  FROM company_members
  WHERE role = 'owner'
  AND status = 'active';
  
  RAISE NOTICE 'Total active owners: %', owner_count;
END $$;

