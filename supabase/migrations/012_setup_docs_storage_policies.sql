-- Setup RLS policies for docs storage bucket
-- This migration sets up policies for the 'docs' bucket
-- 
-- IMPORTANT: Before running this migration, ensure the 'docs' bucket exists in Supabase Storage:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to Storage in the left sidebar
-- 3. Create bucket named 'docs' if it doesn't exist
-- 4. Configure:
--    - Public bucket: ✅ Enable (for public access) OR ❌ Disable (for private access with signed URLs)
--    - File size limit: 2MB
--    - Allowed MIME types: image/jpeg, image/png

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload logos to docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view logos in docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own logos in docs" ON storage.objects;

-- Policy 1: Users can upload logos to docs/logo folder
CREATE POLICY "Users can upload logos to docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'docs' AND
  (storage.foldername(name))[1] = 'logo' AND
  (name ~* '\.(jpg|jpeg|png)$')
);

-- Policy 2: Users can view logos in docs bucket
CREATE POLICY "Users can view logos in docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'docs'
);

-- Policy 3: Users can delete their own uploaded logos
CREATE POLICY "Users can delete own logos in docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'docs' AND
  (storage.foldername(name))[1] = 'logo'
);

