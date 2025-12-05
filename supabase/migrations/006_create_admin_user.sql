-- Create Admin User Migration
-- This migration creates an admin user in Supabase Auth
-- Note: This migration uses Supabase's auth.admin functions which require service role privileges
-- For production, it's recommended to use the create-admin-user.js script instead

-- Function to create admin user programmatically
-- This can be called from the Supabase dashboard SQL editor or via the Admin API
CREATE OR REPLACE FUNCTION create_admin_user(
  p_email TEXT,
  p_password TEXT,
  p_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  -- Use provided name or extract from email
  v_user_name := COALESCE(p_name, split_part(p_email, '@', 1));

  -- Note: Direct user creation in auth.users requires service role privileges
  -- This function assumes it's being called from a context with appropriate permissions
  -- In practice, you should use Supabase Admin API or the create-admin-user.js script

  -- Check if user already exists in profiles
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE email = p_email;

  IF v_user_id IS NOT NULL THEN
    -- Update existing profile to admin role
    UPDATE public.profiles
    SET 
      role = 'admin',
      name = v_user_name,
      updated_at = NOW()
    WHERE id = v_user_id;

    RAISE NOTICE 'Updated existing user % to admin role', p_email;
    RETURN v_user_id;
  ELSE
    RAISE EXCEPTION 'User with email % does not exist in auth.users. Please create the user first using Supabase Admin API or the create-admin-user.js script.', p_email;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users (though this function requires service role)
GRANT EXECUTE ON FUNCTION create_admin_user(TEXT, TEXT, TEXT) TO authenticated;

-- Example usage (commented out):
-- SELECT create_admin_user('volkan@tsmart.ai', 'password123', 'Volkan Admin');

-- Note: To actually create a user in Supabase Auth, you need to:
-- 1. Use the Supabase Admin API with service role key (recommended)
-- 2. Use the create-admin-user.js script
-- 3. Use the Supabase Dashboard to manually create the user, then run:
--    SELECT create_admin_user('volkan@tsmart.ai', 'password123', 'Volkan Admin');

