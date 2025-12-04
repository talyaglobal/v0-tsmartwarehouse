import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, getClientIdentifier, RATE_LIMIT_PRESETS } from './rate-limit'
import { applyCorsHeaders, handleCorsPreflight } from './cors'
import { logger, handleApiError, AppError } from '@/lib/utils/logger'
import { requireAuth, requireRole } from '@/lib/auth/api-middleware'
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
}

/**
 * Wrap API route handler with middleware
 */
export function withApiMiddleware<T = any>(
  handler: (request: NextRequest, context?: { user?: { id: string; email: string; role: UserRole } }) => Promise<NextResponse<T>>,
  options: ApiHandlerOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // Handle CORS preflight
      if (options.cors !== false) {
        const preflightResponse = handleCorsPreflight(request)
        if (preflightResponse) {
          return preflightResponse
        }
      }

      // Check allowed methods
      if (options.methods && !options.methods.includes(request.method)) {
        return NextResponse.json(
          { error: 'Method not allowed' },
          { status: 405 }
        )
      }

      // Rate limiting
      if (options.rateLimit) {
        const identifier = getClientIdentifier(request)
        const rateLimitResult = await rateLimit(identifier, options.rateLimit)

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

          return applyCorsHeaders(request, response, options.cors !== false ? {} : undefined)
        }
      }

      // Authentication
      let user: { id: string; email: string; role: UserRole } | undefined

      if (options.requireAuth || options.requireRole) {
        if (options.requireRole) {
          const authResult = await requireRole(request, options.requireRole)
          if (authResult instanceof NextResponse) {
            return applyCorsHeaders(request, authResult, options.cors !== false ? {} : undefined)
          }
          user = authResult.user
        } else {
          const authResult = await requireAuth(request)
          if (authResult instanceof NextResponse) {
            return applyCorsHeaders(request, authResult, options.cors !== false ? {} : undefined)
          }
          user = authResult.user
        }
      }

      // Execute handler
      const response = await handler(request, { user })

      // Apply CORS headers
      if (options.cors !== false) {
        return applyCorsHeaders(request, response, {})
      }

      return response
    } catch (error) {
      // Handle errors
      const errorResponse = handleApiError(error, {
        path: request.nextUrl.pathname,
        method: request.method,
      })

      const response = NextResponse.json(
        {
          error: errorResponse.message,
          ...(errorResponse.code && { code: errorResponse.code }),
        },
        { status: errorResponse.statusCode }
      )

      // Apply CORS headers even on error
      if (options.cors !== false) {
        return applyCorsHeaders(request, response)
      }

      return response
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

