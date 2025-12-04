import { Redis } from '@upstash/redis'

/**
 * Redis cache utility for caching database queries and API responses
 * Uses Upstash Redis for distributed caching
 * Falls back to in-memory cache if Redis is not configured
 */

// In-memory cache fallback (for development)
class MemoryCache {
  private store: Map<string, { value: any; expiresAt: number }> = new Map()

  async get<T>(key: string): Promise<T | null> {
    const record = this.store.get(key)
    if (!record) return null

    if (Date.now() > record.expiresAt) {
      this.store.delete(key)
      return null
    }

    return record.value as T
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async delPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'))
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key)
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const record = this.store.get(key)
    if (!record) return false
    if (Date.now() > record.expiresAt) {
      this.store.delete(key)
      return false
    }
    return true
  }
}

// Create cache instance
let cache: Redis | MemoryCache

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Production: Use Upstash Redis
  cache = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
} else {
  // Development: Use in-memory cache
  cache = new MemoryCache()
}

/**
 * Cache configuration presets
 */
export const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const

/**
 * Cache key prefixes
 */
export const CACHE_PREFIXES = {
  BOOKING: 'booking',
  BOOKINGS: 'bookings',
  INVOICE: 'invoice',
  INVOICES: 'invoices',
  TASK: 'task',
  TASKS: 'tasks',
  CLAIM: 'claim',
  CLAIMS: 'claims',
  INCIDENT: 'incident',
  INCIDENTS: 'incidents',
  USER: 'user',
  DASHBOARD_STATS: 'dashboard_stats',
  INVENTORY: 'inventory',
  INVENTORY_ITEM: 'inventory_item',
} as const

/**
 * Get value from cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    if (cache instanceof MemoryCache) {
      return await cache.get<T>(key)
    }
    const value = await cache.get<T>(key)
    return value
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error)
    return null
  }
}

/**
 * Set value in cache
 */
export async function setCache(
  key: string,
  value: any,
  ttlSeconds: number = CACHE_TTL.MEDIUM
): Promise<void> {
  try {
    if (cache instanceof MemoryCache) {
      await cache.set(key, value, ttlSeconds)
      return
    }
    await cache.set(key, value, { ex: ttlSeconds })
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error)
    // Don't throw - caching failures should not break the app
  }
}

/**
 * Delete value from cache
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    if (cache instanceof MemoryCache) {
      await cache.del(key)
      return
    }
    await cache.del(key)
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error)
  }
}

/**
 * Delete multiple cache keys matching a pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    if (cache instanceof MemoryCache) {
      await cache.delPattern(pattern)
      return
    }
    // Redis doesn't support pattern deletion directly in REST API
    // This would need to be implemented with a script or SCAN
    // For now, we'll just log it
    console.warn('Pattern deletion not supported in Redis REST API')
  } catch (error) {
    console.error(`Cache delete pattern error for pattern ${pattern}:`, error)
  }
}

/**
 * Check if cache key exists
 */
export async function cacheExists(key: string): Promise<boolean> {
  try {
    if (cache instanceof MemoryCache) {
      return await cache.exists(key)
    }
    const exists = await cache.exists(key)
    return exists === 1
  } catch (error) {
    console.error(`Cache exists error for key ${key}:`, error)
    return false
  }
}

/**
 * Generate cache key with prefix
 */
export function generateCacheKey(prefix: string, ...parts: (string | number | null | undefined)[]): string {
  const validParts = parts.filter((part) => part != null).map(String)
  return `${prefix}:${validParts.join(':')}`
}

/**
 * Invalidate related caches when data changes
 */
export async function invalidateCache(prefix: string, id?: string): Promise<void> {
  try {
    if (id) {
      // Delete specific item cache
      await deleteCache(generateCacheKey(prefix, id))
    }
    // Delete list cache
    await deleteCachePattern(`${prefix}s:*`)
    await deleteCache(generateCacheKey(prefix, 'list'))
  } catch (error) {
    console.error(`Cache invalidation error for prefix ${prefix}:`, error)
  }
}

