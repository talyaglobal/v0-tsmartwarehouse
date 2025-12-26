-- Setup RLS policies for files storage bucket
-- This migration sets up policies for the 'files' bucket to store avatars
-- 
-- IMPORTANT: Before running this migration, ensure the 'files' bucket exists in Supabase Storage:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to Storage in the left sidebar
-- 3. Create bucket named 'files' if it doesn't exist
-- 4. Configure:
--    - Public bucket: ✅ Enable (for public access) OR ❌ Disable (for private access with signed URLs)
--    - File size limit: 2MB
--    - Allowed MIME types: image/jpeg, image/png

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can view avatars in files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars in files" ON storage.objects;

-- Policy 1: Users can upload their own avatars to files/avatar folder
-- Files are organized by user ID in the path: avatar/{userId}_{timestamp}_{random}_{filename}
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'files' AND
  (storage.foldername(name))[1] = 'avatar' AND
  (name ~* '\.(jpg|jpeg|png)$') AND
  -- Ensure the file path starts with the user's ID
  (name ~* ('^avatar/' || auth.uid()::text || '_'))
);

-- Policy 2: Users can view avatars in files bucket
-- All authenticated users can view avatars (they are public profile images)
CREATE POLICY "Users can view avatars in files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'files' AND
  (storage.foldername(name))[1] = 'avatar'
);

-- Policy 3: Users can delete their own uploaded avatars
CREATE POLICY "Users can delete own avatars in files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'files' AND
  (storage.foldername(name))[1] = 'avatar' AND
  -- Ensure the file path starts with the user's ID
  (name ~* ('^avatar/' || auth.uid()::text || '_'))
);

