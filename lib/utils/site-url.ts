/**
 * Get the site URL for email links
 * Works in both local development and production (Vercel)
 */
export function getSiteUrl(): string {
  // First check environment variable
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  // In production (Vercel), use VERCEL_URL if available
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // In production, check VERCEL_BRANCH_URL
  if (process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL}`
  }

  // Default to localhost for development
  const port = process.env.PORT || '3000'
  return `http://localhost:${port}`
}

/**
 * Get site URL from request headers (for server-side usage)
 * Falls back to getSiteUrl() if headers are not available
 */
export function getSiteUrlFromRequest(request?: { headers: Headers | Record<string, string> }): string {
  // If we have a request with headers, try to get URL from there
  if (request?.headers) {
    const headers = request.headers instanceof Headers ? request.headers : new Headers(Object.entries(request.headers))
    
    // Check for Vercel's forwarded host
    const forwardedHost = headers.get('x-forwarded-host')
    const forwardedProto = headers.get('x-forwarded-proto') || 'https'
    
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`
    }

    // Check for host header
    const host = headers.get('host')
    if (host) {
      const protocol = host.includes('localhost') ? 'http' : 'https'
      return `${protocol}://${host}`
    }
  }

  // Fallback to environment-based URL
  return getSiteUrl()
}

