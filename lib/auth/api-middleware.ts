import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { UserRole } from '@/types'

/**
 * Get the authenticated user from the request
 */
export async function getAuthUser(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    return {
      id: user.id,
      email: user.email!,
      role: (user.user_metadata?.role as UserRole) || 'customer',
    }
  } catch (error) {
    console.error('Error getting auth user:', error)
    return null
  }
}

/**
 * Middleware to require authentication for API routes
 */
export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser(request)

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    )
  }

  return { user }
}

/**
 * Middleware to require specific role(s) for API routes
 */
export async function requireRole(
  request: NextRequest,
  requiredRoles: UserRole | UserRole[]
) {
  const authResult = await requireAuth(request)
  
  if (authResult instanceof NextResponse) {
    return authResult // Error response
  }

  const { user } = authResult
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]

  if (!roles.includes(user.role)) {
    return NextResponse.json(
      { 
        error: 'Forbidden', 
        message: `Requires one of the following roles: ${roles.join(', ')}` 
      },
      { status: 403 }
    )
  }

  return { user }
}

/**
 * Alias for requireAuth that returns a consistent response format
 * Used by payment routes
 */
export async function authenticateRequest(request: NextRequest) {
  const user = await getAuthUser(request)

  if (!user) {
    return {
      success: false,
      error: 'Authentication required',
    }
  }

  return {
    success: true,
    user,
  }
}

