-- Update profiles table and trigger to store all user registration data
-- This migration adds storage_interest field and updates the trigger
-- to capture company, phone, and storage_interest from user metadata

-- Add storage_interest column to profiles table if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS storage_interest TEXT;

-- Create index for storage_interest for faster queries
CREATE INDEX IF NOT EXISTS profiles_storage_interest_idx ON profiles(storage_interest);

-- Update the trigger function to capture all user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    name, 
    role,
    company,
    phone,
    storage_interest
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'storage_interest'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, profiles.name),
    company = COALESCE(EXCLUDED.company, profiles.company),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    storage_interest = COALESCE(EXCLUDED.storage_interest, profiles.storage_interest),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger on_auth_user_created already exists from 001_create_profiles_table.sql
-- No need to recreate it, just the function is updated

