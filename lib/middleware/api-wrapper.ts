import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, getClientIdentifier, RATE_LIMIT_PRESETS } from './rate-limit'
import { applyCorsHeaders, handleCorsPreflight } from './cors'
import { handleApiError } from '@/lib/utils/logger'
import { requireAuth, requireRole } from '@/lib/auth/api-middleware'
import { validateCsrfToken } from '@/lib/security/csrf'
import { applySecurityHeaders } from '@/lib/security/headers'
import type { UserRole } from '@/types'

/**
 * API route handler wrapper with middleware
 * Provides: CORS, rate limiting, authentication, error handling
 */
export interface ApiHandlerOptions {
  /**
   * Require authentication
   */
  requireAuth?: boolean
  /**
   * Require specific role(s)
   */
  requireRole?: UserRole | UserRole[]
  /**
   * Rate limit preset
   */
  rateLimit?: keyof typeof RATE_LIMIT_PRESETS
  /**
   * CORS options (optional, uses defaults if not provided)
   */
  cors?: boolean
  /**
   * Allowed HTTP methods
   */
  methods?: string[]
  /**
   * Require CSRF token validation (default: true for state-changing methods)
   */
  requireCsrf?: boolean
}

/**
 * Wrap API route handler with middleware
 */
export function withApiMiddleware<T = any>(
  handler: (request: NextRequest, context?: { user?: { id: string; email: string; role: UserRole } }) => Promise<NextResponse<T>>,
  options: ApiHandlerOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    try {
      // Handle CORS preflight
      if (options.cors !== false) {
        const preflightResponse = handleCorsPreflight(request)
        if (preflightResponse) {
          return preflightResponse as NextResponse<T>
        }
      }

      // Check allowed methods
      if (options.methods && !options.methods.includes(request.method)) {
        return NextResponse.json(
          { error: 'Method not allowed' },
          { status: 405 }
        ) as NextResponse<T>
      }

      // CSRF protection (for state-changing methods)
      if (options.requireCsrf !== false) {
        const csrfResponse = await validateCsrfToken(request)
        if (csrfResponse) {
          return applySecurityHeaders(
            applyCorsHeaders(request, csrfResponse, options.cors !== false ? {} : undefined)
          ) as NextResponse<T>
        }
      }

      // Rate limiting (apply to all requests by default)
      const rateLimitPreset = options.rateLimit || 'api'
      const identifier = getClientIdentifier(request)
      const rateLimitResult = await rateLimit(identifier, rateLimitPreset)

      if (!rateLimitResult.success) {
        const response = NextResponse.json(
          {
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
          },
          { status: 429 }
        )

        // Add rate limit headers
        response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
        response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
        response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())

        return applySecurityHeaders(
          applyCorsHeaders(request, response, options.cors !== false ? {} : undefined)
        ) as NextResponse<T>
      }

      // Authentication
      let user: { id: string; email: string; role: UserRole } | undefined

      if (options.requireAuth || options.requireRole) {
        if (options.requireRole) {
          const authResult = await requireRole(request, options.requireRole)
          if (authResult instanceof NextResponse) {
            return applyCorsHeaders(request, authResult, options.cors !== false ? {} : undefined) as NextResponse<T>
          }
          user = authResult.user
        } else {
          const authResult = await requireAuth(request)
          if (authResult instanceof NextResponse) {
            return applyCorsHeaders(request, authResult, options.cors !== false ? {} : undefined) as NextResponse<T>
          }
          user = authResult.user
        }
      }

      // Execute handler
      let response = await handler(request, { user })

      // Apply CORS headers
      if (options.cors !== false) {
        response = applyCorsHeaders(request, response, {}) as NextResponse<T>
      }

      // Apply security headers
      response = applySecurityHeaders(response) as NextResponse<T>

      // Add rate limit headers to successful responses
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
      response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString())

      return response
    } catch (error) {
      // Handle errors
      const errorResponse = handleApiError(error, {
        path: request.nextUrl.pathname,
        method: request.method,
      })

      let response = NextResponse.json(
        {
          error: errorResponse.message,
          ...(errorResponse.code && { code: errorResponse.code }),
        },
        { status: errorResponse.statusCode }
      )

      // Apply CORS headers even on error
      if (options.cors !== false) {
        response = applyCorsHeaders(request, response) as any
      }

      // Apply security headers even on error
      response = applySecurityHeaders(response) as any

      return response as NextResponse<T>
    }
  }
}

/**
 * Create a standardized API response
 */
export function apiResponse<T>(
  data: T,
  status: number = 200,
  message?: string
): NextResponse {
  return NextResponse.json(
    {
      success: status >= 200 && status < 300,
      data,
      ...(message && { message }),
    },
    { status }
  )
}

/**
 * Create an error API response
 */
export function apiError(
  message: string,
  status: number = 400,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(code && { code }),
    },
    { status }
  )
}

// Alias export for backward compatibility
export const apiWrapper = withApiMiddleware

