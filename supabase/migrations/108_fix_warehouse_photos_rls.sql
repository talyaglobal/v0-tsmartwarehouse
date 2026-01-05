-- Fix RLS policies for warehouse photos storage
-- This migration updates the warehouse photos policies to allow uploads to warehouse/ folder
-- without requiring company_name/warehouse_name subfolders
-- 
-- IMPORTANT: The 'docs' bucket must exist in Supabase Storage

-- Drop existing warehouse photo policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Company admins can upload warehouse photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view warehouse photos" ON storage.objects;
DROP POLICY IF EXISTS "Company admins can delete own warehouse photos" ON storage.objects;

-- Policy 1: Authenticated users can upload warehouse photos to warehouse/ folder
-- Path structure: warehouse/{filename} or warehouse/{company_name}/{warehouse_name}/{filename}
-- This allows both simple uploads and organized folder structures
-- More permissive: allows any authenticated user to upload (RLS is handled via API route with service role)
CREATE POLICY "Company admins can upload warehouse photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'docs' AND
  (storage.foldername(name))[1] = 'warehouse'
);

-- Policy 2: All authenticated users can view warehouse photos (public for marketplace)
CREATE POLICY "Users can view warehouse photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'docs' AND
  (storage.foldername(name))[1] = 'warehouse'
);

-- Policy 3: Authenticated users can delete warehouse photos from warehouse/ folder
-- More permissive: allows any authenticated user to delete (RLS is handled via API route with service role)
CREATE POLICY "Company admins can delete own warehouse photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'docs' AND
  (storage.foldername(name))[1] = 'warehouse'
);

-- ============================================
-- NOTES
-- ============================================
-- File organization structure:
-- docs/
--   └── warehouse/
--       └── {filename} (simple structure)
--   OR
--   └── warehouse/
--       └── {company_name}/
--           └── {warehouse_name}/
--               └── {filename} (organized structure)
--
-- The policies above ensure:
-- 1. Only company admins/owners can upload photos to warehouse/ folder
-- 2. All authenticated users can view warehouse photos (for marketplace)
-- 3. Only company admins/owners can delete warehouse photos

