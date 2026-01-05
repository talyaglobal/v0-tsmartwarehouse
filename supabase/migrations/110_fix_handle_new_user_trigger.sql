-- Fix handle_new_user trigger function to use correct default role
-- This migration updates the trigger function to use 'customer' as default instead of 'member'
-- and ensures it handles warehouse_owner role correctly
-- Created: 2026-01-XX

-- Update the trigger function to use correct default role and handle all valid roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get role from user metadata, default to 'customer' if not provided or invalid
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  
  -- Validate role - if not in valid roles list, default to 'customer'
  IF user_role NOT IN ('root', 'warehouse_owner', 'warehouse_admin', 'customer', 'warehouse_staff') THEN
    user_role := 'customer';
  END IF;
  
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
      user_role,
      NEW.raw_user_meta_data->>'company',
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'storage_interest'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, profiles.name),
      company = COALESCE(EXCLUDED.company, profiles.company),
      phone = COALESCE(EXCLUDED.phone, profiles.phone),
      storage_interest = COALESCE(EXCLUDED.storage_interest, profiles.storage_interest),
      role = COALESCE(EXCLUDED.role, profiles.role),
      updated_at = NOW();
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the user creation
      RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
      -- Try to insert with minimal data as fallback
      BEGIN
        INSERT INTO public.profiles (id, email, name, role)
        VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), user_role)
        ON CONFLICT (id) DO NOTHING;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Fallback profile creation also failed for user %: %', NEW.id, SQLERRM;
      END;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger on_auth_user_created already exists, no need to recreate it

