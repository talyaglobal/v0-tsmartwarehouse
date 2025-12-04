import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHmac } from 'crypto'

/**
 * CSRF protection utilities
 * Implements Double Submit Cookie pattern
 */

const CSRF_TOKEN_COOKIE = 'csrf-token'
const CSRF_TOKEN_HEADER = 'X-CSRF-Token'
const CSRF_TOKEN_LENGTH = 32

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

/**
 * Get or create CSRF token for the current session
 */
export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies()
  let token = cookieStore.get(CSRF_TOKEN_COOKIE)?.value

  if (!token) {
    token = generateCsrfToken()
    cookieStore.set(CSRF_TOKEN_COOKIE, token, {
      httpOnly: false, // Must be accessible to JavaScript for Double Submit Cookie pattern
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })
  }

  return token
}

/**
 * Verify CSRF token from request
 */
export async function verifyCsrfToken(request: NextRequest): Promise<boolean> {
  const cookieStore = await cookies()
  const cookieToken = cookieStore.get(CSRF_TOKEN_COOKIE)?.value
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER)

  // Both tokens must exist and match
  if (!cookieToken || !headerToken) {
    return false
  }

  // Use constant-time comparison to prevent timing attacks
  return constantTimeEquals(cookieToken, headerToken)
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Middleware to validate CSRF token for state-changing requests
 */
export async function validateCsrfToken(
  request: NextRequest
): Promise<NextResponse | null> {
  // Only validate state-changing methods
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE']
  
  if (!stateChangingMethods.includes(request.method)) {
    return null // No validation needed for GET, OPTIONS, etc.
  }

  // Skip CSRF validation for public API endpoints that use other auth methods
  const publicEndpoints = ['/api/health']
  const pathname = request.nextUrl.pathname
  
  if (publicEndpoints.some(endpoint => pathname.startsWith(endpoint))) {
    return null
  }

  const isValid = await verifyCsrfToken(request)

  if (!isValid) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid CSRF token',
        message: 'CSRF token validation failed. Please refresh the page and try again.',
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Get CSRF token for client-side use
 * This should be called from a Server Component or API route
 */
export async function getCsrfTokenForClient(): Promise<{ token: string }> {
  const token = await getCsrfToken()
  return { token }
}

