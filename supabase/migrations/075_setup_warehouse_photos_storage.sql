-- Add photos column to warehouses table and setup RLS policies for warehouse photos
-- Warehouse photos are stored in: docs/warehouse/{company_name}/{warehouse_name}/
-- 
-- IMPORTANT: The 'docs' bucket must exist in Supabase Storage (created in migration 012_setup_docs_storage_policies.sql)

-- Add photos column to warehouses table
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS photos TEXT[];

COMMENT ON COLUMN warehouses.photos IS 'Array of photo paths in storage bucket (docs/warehouse/{company_name}/{warehouse_name}/...)';

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Company admins can upload warehouse photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view warehouse photos" ON storage.objects;
DROP POLICY IF EXISTS "Company admins can delete own warehouse photos" ON storage.objects;

-- Policy 1: Company admins can upload warehouse photos to their company's warehouse folder
-- Path structure: warehouse/{company_name}/{warehouse_name}/{filename}
CREATE POLICY "Company admins can upload warehouse photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'docs' AND
  (storage.foldername(name))[1] = 'warehouse' AND
  -- Verify user is a company admin
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('company_admin', 'root')
  )
);

-- Policy 2: All authenticated users can view warehouse photos (public for now, can be restricted later)
CREATE POLICY "Users can view warehouse photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'docs' AND
  (storage.foldername(name))[1] = 'warehouse'
);

-- Policy 3: Company admins can delete warehouse photos from their company's folders
CREATE POLICY "Company admins can delete own warehouse photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'docs' AND
  (storage.foldername(name))[1] = 'warehouse' AND
  -- Verify user is a company admin
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('company_admin', 'root')
  )
);

-- ============================================
-- NOTES
-- ============================================
-- File organization structure:
-- docs/
--   └── warehouse/
--       └── {company_name}/
--           └── {warehouse_name}/
--               └── {timestamp}_{random}_{filename}
--
-- Example:
-- docs/warehouse/acme-corp/NY-GN-A3B7K/1701234567890_abc123_warehouse_exterior.jpg
--
-- The policies above ensure:
-- 1. Only company admins can upload photos to warehouse folders
-- 2. All authenticated users can view warehouse photos
-- 3. Only company admins can delete warehouse photos

