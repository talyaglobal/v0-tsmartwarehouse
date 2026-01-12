-- TSmart Warehouse Management System - Storage Bucket Setup
-- This migration sets up RLS policies for Supabase Storage
-- 
-- IMPORTANT: Before running this migration, you MUST create the storage bucket manually:
-- 1. Go to your Supabase Dashboard (https://app.supabase.com)
-- 2. Navigate to Storage in the left sidebar
-- 3. Click "Create a new bucket"
-- 4. Configure:
--    - Name: claim-evidence
--    - Public bucket: ✅ Enable (for public access) OR ❌ Disable (for private access with signed URLs)
--    - File size limit: 10MB (recommended)
--    - Allowed MIME types: Leave empty to allow all configured types
-- 5. Click "Create bucket"
--
-- After creating the bucket, run this migration to set up the RLS policies.

-- ============================================
-- STORAGE BUCKET POLICIES
-- ============================================
-- These policies control access to files in the 'claim-evidence' bucket

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload files for any user" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update any file" ON storage.objects;

-- Policy 1: Users can upload their own files
-- Files are organized by user ID in the path: claims/{userId}/...
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'claim-evidence' AND
  (storage.foldername(name))[1] = 'claims' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy 2: Users can view their own files
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'claim-evidence' AND
  (
    -- Users can view files in their own folder
    (storage.foldername(name))[1] = 'claims' AND
    (storage.foldername(name))[2] = auth.uid()::text
  ) OR
  -- Admins can view all files
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy 3: Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'claim-evidence' AND
  (
    -- Users can delete files in their own folder
    (storage.foldername(name))[1] = 'claims' AND
    (storage.foldername(name))[2] = auth.uid()::text
  ) OR
  -- Admins can delete any file
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy 4: Admins can upload files for any user
CREATE POLICY "Admins can upload files for any user"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'claim-evidence' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy 5: Admins can update any file
CREATE POLICY "Admins can update any file"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'claim-evidence' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'claim-evidence' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- ============================================
-- NOTES
-- ============================================
-- File organization structure:
-- claim-evidence/
--   └── claims/
--       └── {userId}/
--           └── {timestamp}_{random}_{filename}
--
-- Example:
-- claim-evidence/claims/user-123/1701234567890_abc123_damage_photo.jpg
--
-- The policies above ensure:
-- 1. Users can only access files in their own folder (claims/{userId}/...)
-- 2. Admins have full access to all files
-- 3. File paths are validated to ensure proper organization

