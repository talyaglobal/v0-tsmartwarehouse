import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getCache, setCache, CACHE_TTL } from './redis'

/**
 * API response caching utilities
 * Combines Next.js unstable_cache with Redis for optimal performance
 */

export interface CacheOptions {
  tags?: string[]
  revalidate?: number | false
  ttl?: number
  key?: string
}

/**
 * Wrap API handler with caching
 */
export function withCache<T>(
  handler: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { tags = [], revalidate = false, ttl = CACHE_TTL.MEDIUM, key } = options

  // If revalidate is set, use Next.js cache
  if (revalidate !== false) {
    return unstable_cache(
      handler,
      key ? [key] : tags,
      {
        revalidate,
        tags,
      }
    )()
  }

  // Otherwise use Redis cache
  if (key) {
    return getCachedOrExecute(key, handler, ttl)
  }

  // If no key provided, just execute without caching
  return handler()
}

/**
 * Get cached value or execute function and cache result
 */
async function getCachedOrExecute<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cached = await getCache<T>(key)
  if (cached) {
    return cached
  }

  const result = await fn()
  await setCache(key, result, ttl)
  return result
}

/**
 * Create cache tags for invalidation
 */
export function createCacheTags(...parts: string[]): string[] {
  return parts.filter(Boolean)
}

/**
 * Set cache headers on Next.js response
 */
export function setCacheHeaders(
  response: NextResponse,
  maxAge: number = 300,
  staleWhileRevalidate: number = 60
): NextResponse {
  response.headers.set(
    'Cache-Control',
    `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  )
  return response
}

/**
 * Create cache key for API route
 */
export function createApiCacheKey(path: string, params?: Record<string, any>): string {
  const paramString = params
    ? Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join(':')
    : ''
  return `api:${path}${paramString ? `:${paramString}` : ''}`
}

