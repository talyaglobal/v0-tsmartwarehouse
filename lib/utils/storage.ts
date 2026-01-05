/**
 * Storage utility functions
 * 
 * Helper functions for working with Supabase Storage URLs
 */

/**
 * Convert a relative storage path to a full Supabase Storage public URL
 * 
 * @param path - Relative path (e.g., "warehouse/id/file.jpg") or full URL
 * @param bucket - Storage bucket name (default: "docs")
 * @returns Full public URL
 */
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
  // Format: https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`
}

/**
 * Convert an array of photo paths to full Supabase Storage public URLs
 * 
 * @param photos - Array of relative paths or full URLs
 * @param bucket - Storage bucket name (default: "docs")
 * @returns Array of full public URLs
 */
export function getStoragePublicUrls(photos: string[], bucket: string = 'docs'): string[] {
  return photos.map(photo => getStoragePublicUrl(photo, bucket))
}

