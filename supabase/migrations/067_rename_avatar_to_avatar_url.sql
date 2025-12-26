-- Rename avatar column to avatar_url in profiles table
-- This migration renames the avatar column to avatar_url for consistency

-- Check if avatar column exists and rename it to avatar_url
-- If avatar_url already exists, skip the rename
DO $$ 
BEGIN
  -- Check if avatar column exists and avatar_url doesn't exist
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'avatar'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'avatar_url'
  ) THEN
    -- Rename the column
    ALTER TABLE profiles RENAME COLUMN avatar TO avatar_url;
  END IF;
END $$;

-- Add comment to the column if it exists
COMMENT ON COLUMN profiles.avatar_url IS 'URL to the user profile avatar image stored in storage/docs/avatar';

