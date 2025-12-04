import { NextResponse, type NextRequest } from 'next/server'

/**
 * CORS configuration
 * Configure allowed origins, methods, and headers
 */

export interface CorsOptions {
  origin?: string | string[] | ((origin: string | null) => boolean)
  methods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}

const defaultOptions: CorsOptions = {
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: true,
  maxAge: 86400, // 24 hours
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null, allowedOrigin: CorsOptions['origin']): boolean {
  if (!origin) return false
  if (!allowedOrigin) return true

  if (typeof allowedOrigin === 'string') {
    return origin === allowedOrigin
  }

  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(origin)
  }

  if (typeof allowedOrigin === 'function') {
    return allowedOrigin(origin)
  }

  return false
}

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(
  request: NextRequest,
  response: NextResponse,
  options: CorsOptions = {}
): NextResponse {
  const corsOptions = { ...defaultOptions, ...options }
  const origin = request.headers.get('origin')

  // Check if origin is allowed
  if (origin && isOriginAllowed(origin, corsOptions.origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  } else if (typeof corsOptions.origin === 'string') {
    response.headers.set('Access-Control-Allow-Origin', corsOptions.origin)
  }

  // Set allowed methods
  if (corsOptions.methods) {
    response.headers.set('Access-Control-Allow-Methods', corsOptions.methods.join(', '))
  }

  // Set allowed headers
  if (corsOptions.allowedHeaders) {
    response.headers.set('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '))
  }

  // Set exposed headers
  if (corsOptions.exposedHeaders) {
    response.headers.set('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(', '))
  }

  // Set credentials
  if (corsOptions.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  // Set max age
  if (corsOptions.maxAge) {
    response.headers.set('Access-Control-Max-Age', corsOptions.maxAge.toString())
  }

  return response
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflight(request: NextRequest, options: CorsOptions = {}): NextResponse | null {
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 })
    return applyCorsHeaders(request, response, options)
  }
  return null
}

