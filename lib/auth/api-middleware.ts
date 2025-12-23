import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { UserRole } from '@/types'

/**
 * Get the authenticated user from the request
 * Uses cookies from the request to authenticate
 */
export async function getAuthUser(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return null
    }

    // Create Supabase client that reads cookies from NextRequest
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // In API routes, we can't set cookies in the response here
          // The middleware handles cookie updates
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
        },
      },
    })

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      if (error) {
        console.error('Error getting user from Supabase:', error.message)
      }
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

