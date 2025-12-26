-- Add avatar upload policies to docs bucket
-- This migration adds policies for avatar uploads to the existing 'docs' bucket
-- Avatars will be stored in docs/avatar/ folder

-- Drop existing avatar policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload own avatars to docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view avatars in docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars in docs" ON storage.objects;

-- Policy 1: Users can upload their own avatars to docs/avatar folder
-- Files are organized by user ID in the path: avatar/{userId}_{timestamp}_{random}_{filename}
CREATE POLICY "Users can upload own avatars to docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'docs' AND
  (storage.foldername(name))[1] = 'avatar' AND
  (name ~* '\.(jpg|jpeg|png)$') AND
  -- Ensure the file path starts with the user's ID
  (name ~* ('^avatar/' || auth.uid()::text || '_'))
);

-- Policy 2: Users can view avatars in docs bucket
-- All authenticated users can view avatars (they are public profile images)
CREATE POLICY "Users can view avatars in docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'docs' AND
  (storage.foldername(name))[1] = 'avatar'
);

-- Policy 3: Users can delete their own uploaded avatars
CREATE POLICY "Users can delete own avatars in docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'docs' AND
  (storage.foldername(name))[1] = 'avatar' AND
  -- Ensure the file path starts with the user's ID
  (name ~* ('^avatar/' || auth.uid()::text || '_'))
);

