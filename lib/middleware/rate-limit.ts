import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate limiter configuration
 * Uses Upstash Redis for distributed rate limiting
 * Falls back to in-memory rate limiting if Redis is not configured
 */

// In-memory rate limiter fallback (for development)
class MemoryRateLimiter {
  private store: Map<string, { count: number; resetAt: number }> = new Map()

  async limit(identifier: string, limit: number, window: number): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const now = Date.now()
    const key = identifier
    const record = this.store.get(key)

    if (!record || now > record.resetAt) {
      // Create new record
      this.store.set(key, {
        count: 1,
        resetAt: now + window * 1000,
      })
      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: Math.floor((now + window * 1000) / 1000),
      }
    }

    if (record.count >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: Math.floor(record.resetAt / 1000),
      }
    }

    record.count++
    return {
      success: true,
      limit,
      remaining: limit - record.count,
      reset: Math.floor(record.resetAt / 1000),
    }
  }
}

// Create rate limiter instance
let rateLimiter: Ratelimit | MemoryRateLimiter

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Production: Use Upstash Redis
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

  rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds by default
    analytics: true,
  })
} else {
  // Development: Use in-memory rate limiter
  rateLimiter = new MemoryRateLimiter()
}

/**
 * Rate limit configuration presets
 */
export const RATE_LIMIT_PRESETS = {
  // API routes
  api: {
    limit: 100,
    window: 60, // 100 requests per minute
  },
  // Authentication routes (stricter)
  auth: {
    limit: 5,
    window: 60, // 5 requests per minute
  },
  // Public routes (more lenient)
  public: {
    limit: 200,
    window: 60, // 200 requests per minute
  },
  // Admin routes
  admin: {
    limit: 500,
    window: 60, // 500 requests per minute
  },
} as const

/**
 * Apply rate limiting to a request
 * @param identifier - Unique identifier (IP address, user ID, etc.)
 * @param preset - Rate limit preset to use
 * @returns Rate limit result
 */
export async function rateLimit(
  identifier: string,
  preset: keyof typeof RATE_LIMIT_PRESETS = 'api'
) {
  const config = RATE_LIMIT_PRESETS[preset]

  if (rateLimiter instanceof MemoryRateLimiter) {
    return await rateLimiter.limit(identifier, config.limit, config.window)
  }

  // Upstash rate limiter
  const result = await rateLimiter.limit(identifier)
  return {
    success: result.success,
    limit: config.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

/**
 * Get client identifier from request
 * Uses IP address or user ID if available
 */
export function getClientIdentifier(request: Request): string {
  // Try to get user ID from headers (if authenticated)
  const userId = request.headers.get('x-user-id')
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
}

