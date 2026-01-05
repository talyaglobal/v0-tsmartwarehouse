# Warehouse Photos URL Fix Report

**Date:** January 4, 2026  
**Status:** ✅ **FIXED**

---

## Problem

Next.js Image component was receiving relative paths instead of absolute URLs:

```
Error: Failed to parse src "warehouse/391097f0-cfb5-46ac-9981-08184e6a7315/1767377928322_in75hwqqr7_Warehouse-Racking-Systems.jpeg" on `next/image`, if using relative image it must start with a leading slash "/" or be an absolute URL (http:// or https://)
```

## Root Cause

Warehouse photos are stored in the database as relative paths (e.g., `warehouse/391097f0-cfb5-46ac-9981-08184e6a7315/1767377928322_in75hwqqr7_Warehouse-Racking-Systems.jpeg`), but Next.js `Image` component requires:
1. Absolute URLs (starting with `http://` or `https://`), OR
2. Relative paths starting with `/` (for public folder)

The warehouse search service (`lib/services/warehouse-search-supabase.ts`) was passing photos through as-is without converting relative paths to full Supabase Storage URLs.

## Solution

Created a utility function to convert relative storage paths to full Supabase Storage public URLs, and applied it in all places where warehouse photos are retrieved.

### 1. Created Storage Utility (`lib/utils/storage.ts`)

**New file:** `lib/utils/storage.ts`

**Functions:**
- `getStoragePublicUrl(path: string, bucket: string = 'docs'): string`
  - Converts a relative storage path to a full Supabase Storage public URL
  - Handles already-full URLs (returns as-is)
  - Handles paths with or without leading slash
  - Constructs URL: `https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<path>`

- `getStoragePublicUrls(photos: string[], bucket: string = 'docs'): string[]`
  - Converts an array of photo paths to full URLs
  - Uses `getStoragePublicUrl` for each photo

### 2. Updated Warehouse Search Service

**File:** `lib/services/warehouse-search-supabase.ts`

**Changes:**
1. Added import: `import { getStoragePublicUrls } from '@/lib/utils/storage'`

2. **PostGIS Search Results** (line ~49):
   - Convert photos using `getStoragePublicUrls(wh.photos, 'docs')`
   - Applied before mapping results

3. **Regular Query Results** (line ~239):
   - Convert photos using `getStoragePublicUrls(wh.photos, 'docs')`
   - Applied in the map function

4. **getWarehouseById Function** (line ~313):
   - Convert photos using `getStoragePublicUrls(warehouse.photos, 'docs')`
   - Applied when returning warehouse data

## Code Changes

### `lib/utils/storage.ts` (NEW)

```typescript
export function getStoragePublicUrl(path: string, bucket: string = 'docs'): string {
  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  // If path starts with /, remove it
  const cleanPath = path.startsWith('/') ? path.slice(1) : path

  // Get Supabase URL from environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    console.warn('[storage] NEXT_PUBLIC_SUPABASE_URL not set, returning path as-is')
    return path
  }

  // Construct public URL
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`
}

export function getStoragePublicUrls(photos: string[], bucket: string = 'docs'): string[] {
  return photos.map(photo => getStoragePublicUrl(photo, bucket))
}
```

### `lib/services/warehouse-search-supabase.ts`

**Before:**
```typescript
photos: wh.photos || [],
```

**After:**
```typescript
const photos = wh.photos && Array.isArray(wh.photos) ? getStoragePublicUrls(wh.photos, 'docs') : []
// ...
photos: photos,
```

## Storage Bucket

Warehouse photos are stored in the `docs` bucket (as configured in migration `075_setup_warehouse_photos_storage.sql`).

## URL Format

**Before (relative path):**
```
warehouse/391097f0-cfb5-46ac-9981-08184e6a7315/1767377928322_in75hwqqr7_Warehouse-Racking-Systems.jpeg
```

**After (full URL):**
```
https://<project-ref>.supabase.co/storage/v1/object/public/docs/warehouse/391097f0-cfb5-46ac-9981-08184e6a7315/1767377928322_in75hwqqr7_Warehouse-Racking-Systems.jpeg
```

## Build Status

✅ **Build Successful**

All TypeScript checks passed. The utility function is properly typed and integrated.

## Testing Recommendations

1. **Visual Verification:**
   - Go to `/find-warehouses`
   - Verify warehouse images load correctly in cards
   - Click on a warehouse to view detail page
   - Verify photo gallery displays all images

2. **Network Verification:**
   - Open browser DevTools → Network tab
   - Filter by "Img" or "Image"
   - Verify image requests use full Supabase URLs (starting with `https://`)
   - Verify no 404 errors for images

3. **Edge Cases:**
   - Test warehouses with no photos (empty array)
   - Test warehouses with already-full URLs (should remain unchanged)
   - Test warehouses with single photo
   - Test warehouses with multiple photos

## Related Files

- `lib/utils/storage.ts` - NEW utility file
- `lib/services/warehouse-search-supabase.ts` - Updated to use utility
- `components/marketplace/warehouse-card.tsx` - Uses photos from search service
- `components/marketplace/photo-gallery.tsx` - Displays photos
- `components/marketplace/warehouse-detail-view.tsx` - Uses photos from search service

## Notes

- The utility function handles edge cases:
  - Already-full URLs (returns as-is)
  - Paths with or without leading slash
  - Missing environment variable (returns path as-is with warning)
  - Empty/null arrays

- The bucket name `docs` is hardcoded as the default, matching the migration configuration.

- This fix ensures consistency across all warehouse photo retrieval points.

---

*Report generated after successful fix on January 4, 2026*

