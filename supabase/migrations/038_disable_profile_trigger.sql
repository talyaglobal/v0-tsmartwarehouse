-- Disable the automatic profile creation trigger
-- Profile will be created manually in the signUp action with company_id
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

