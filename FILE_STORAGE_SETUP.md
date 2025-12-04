# File Storage Setup Guide

This guide explains how to set up file storage for claim evidence and other file uploads using Supabase Storage.

## Overview

The file management system uses **Supabase Storage** for:
- Claim evidence uploads (images, PDFs, documents)
- Secure file storage with access control
- File validation and processing
- Automatic file organization by user

## Features Implemented

✅ **File upload component** with drag-and-drop support  
✅ **File validation** (type, size limits)  
✅ **Image preview** and file management  
✅ **Supabase Storage integration**  
✅ **Secure file access** with authentication  
✅ **API routes** for file upload/download  
✅ **File deletion** functionality  

## Setup Instructions

### 1. Create Storage Bucket in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Storage** in the left sidebar
3. Click **Create a new bucket**
4. Configure the bucket:
   - **Name**: `claim-evidence`
   - **Public bucket**: ✅ Enable (for public access) OR ❌ Disable (for private access with signed URLs)
   - **File size limit**: 10MB (recommended)
   - **Allowed MIME types**: Leave empty to allow all configured types
5. Click **Create bucket**

### 2. Configure Storage Policies (Row Level Security)

For secure file access, set up RLS policies:

#### Option A: Public Bucket (Simpler)

If you made the bucket public, files are accessible via public URLs. This is fine for claim evidence as long as file paths are secure.

#### Option B: Private Bucket with RLS (More Secure)

1. In the Supabase Dashboard, go to **Storage** → **Policies**
2. Click on your `claim-evidence` bucket
3. Create policies:

**Policy 1: Users can upload their own files**
```sql
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'claim-evidence' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Policy 2: Users can view their own files**
```sql
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'claim-evidence' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Policy 3: Users can delete their own files**
```sql
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'claim-evidence' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Policy 4: Admins can view all files**
```sql
CREATE POLICY "Admins can view all files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'claim-evidence' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

### 3. File Organization Structure

Files are organized as follows:
```
claim-evidence/
  └── claims/
      └── {userId}/
          └── {timestamp}_{random}_{filename}
```

Example:
```
claim-evidence/claims/user-123/1701234567890_abc123_damage_photo.jpg
```

### 4. Environment Variables

No additional environment variables are required beyond your existing Supabase configuration:
- `NEXT_PUBLIC_SUPABASE_URL` ✅ Already configured
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅ Already configured

## Usage

### In Forms

The `FileUpload` component can be used in any form:

```tsx
import { FileUpload, type UploadedFile, getUploadedFileUrls } from '@/components/ui/file-upload'

function MyForm() {
  const [files, setFiles] = useState<UploadedFile[]>([])

  const handleSubmit = async () => {
    const fileUrls = getUploadedFileUrls(files)
    // Submit fileUrls along with form data
  }

  return (
    <FileUpload
      value={files}
      onChange={setFiles}
      bucket="claim-evidence"
      folder="claims"
      maxFiles={10}
    />
  )
}
```

### File Upload Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `UploadedFile[]` | `[]` | Array of uploaded files |
| `onChange` | `(files: UploadedFile[]) => void` | - | Callback when files change |
| `bucket` | `string` | `'claim-evidence'` | Supabase Storage bucket name |
| `folder` | `string` | `'claims'` | Folder within bucket |
| `maxSize` | `number` | `10MB` | Maximum file size in bytes |
| `maxFiles` | `number` | `10` | Maximum number of files |
| `acceptedFileTypes` | `string[]` | All allowed types | Array of MIME types to accept |
| `disabled` | `boolean` | `false` | Disable file upload |

### Supported File Types

**Images:**
- JPEG/JPG
- PNG
- WebP
- GIF

**Documents:**
- PDF
- Word (.doc, .docx)
- Excel (.xls, .xlsx)
- Text files (.txt)

### File Size Limits

- **Default**: 10MB per file
- **Configurable**: Pass `maxSize` prop to `FileUpload` component

## API Routes

### Upload File

```typescript
POST /api/v1/files/upload

FormData:
  - file: File
  - bucket?: string (default: 'claim-evidence')
  - folder?: string (default: 'claims')

Response:
{
  success: true,
  data: {
    url: string,      // Public URL
    path: string,     // Storage path
    name: string,     // Original filename
    size: number,     // File size in bytes
    mimeType: string  // MIME type
  }
}
```

### Delete File

```typescript
DELETE /api/v1/files/upload

Body:
{
  path: string,       // Storage path
  bucket?: string     // Default: 'claim-evidence'
}

Response:
{
  success: true
}
```

## File Validation

Files are automatically validated for:
- ✅ File type (MIME type checking)
- ✅ File size (configurable limit)
- ✅ Maximum number of files

Validation errors are displayed inline in the component.

## Security Features

1. **Authentication Required**: All uploads require user authentication
2. **User Isolation**: Files are organized by user ID
3. **File Validation**: Type and size validation before upload
4. **Access Control**: RLS policies control file access
5. **Secure Paths**: Files have unique, unpredictable paths

## Troubleshooting

### "Bucket not found" error
- Ensure the bucket `claim-evidence` exists in your Supabase project
- Check bucket name matches exactly (case-sensitive)

### "Access denied" error
- Check RLS policies are configured correctly
- Verify user is authenticated
- For private buckets, ensure signed URLs are used

### File upload fails silently
- Check browser console for errors
- Verify file size is within limits
- Check file type is allowed
- Verify Supabase credentials are correct

### Files not appearing after upload
- Check bucket is set to public (if using public URLs)
- Verify file paths are correct
- Check RLS policies allow access

## Next Steps

1. ✅ Create storage bucket in Supabase
2. ✅ Configure RLS policies
3. ✅ Test file uploads in the claim form
4. ✅ Verify files are accessible
5. ⚠️ Set up automatic cleanup of old files (optional)
6. ⚠️ Configure CDN for faster file delivery (optional)

## File Cleanup (Optional)

To automatically delete old files, you can set up a Supabase Edge Function or database function that runs periodically.

Example cleanup function:
```sql
CREATE OR REPLACE FUNCTION cleanup_old_files()
RETURNS void AS $$
BEGIN
  -- Delete files older than 1 year that are not linked to active claims
  -- This is just an example - implement based on your needs
END;
$$ LANGUAGE plpgsql;
```

## Resources

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Supabase Storage Policies](https://supabase.com/docs/guides/storage/security/access-control)
- [File Upload Component](/components/ui/file-upload.tsx)
- [Storage Utils](/lib/storage/utils.ts)

---

**Status**: ✅ Implementation complete, ready for Supabase Storage setup

