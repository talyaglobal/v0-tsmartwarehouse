import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { applySecurityHeaders } from '@/lib/security/headers'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Apply security headers to all responses
  response = applySecurityHeaders(response, {
    strictTransportSecurity: process.env.NODE_ENV === 'production',
  })

  // Check if Supabase environment variables are available
  // During build time, these may not be available, so we skip auth checks
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If env vars are missing (e.g., during build), skip auth checks and return early
  if (!supabaseUrl || !supabaseAnonKey) {
    // For public routes, allow access during build
    const pathname = request.nextUrl.pathname
    const publicRoutes = ['/', '/login', '/admin-login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/terms', '/privacy']
    const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))
    
    if (isPublicRoute || pathname.startsWith('/api')) {
      return response
    }
    
    // For protected routes during build, redirect to login
    // This will be handled properly at runtime when env vars are available
    const isAdminRoute = pathname.startsWith('/admin')
    const isDashboardRoute = pathname.startsWith('/dashboard')
    const isWorkerRoute = pathname.startsWith('/worker')
    
    if (isAdminRoute) {
      const redirectUrl = new URL('/admin-login', request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    if (isDashboardRoute || isWorkerRoute) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    return response
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  let user = null
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser
  } catch (error) {
    // If auth check fails (e.g., during build), continue without user
    // This allows the build to complete
    console.warn('Auth check failed in middleware:', error)
  }

  const pathname = request.nextUrl.pathname

  // Auth routes (login, register, admin-login, accept-invitation) - redirect if already authenticated
  const authRoutes = ['/login', '/register', '/admin-login']
  const isAuthRoute = authRoutes.includes(pathname) || pathname.startsWith('/accept-invitation/')
  const isAdminLoginRoute = pathname === '/admin-login'

  // Protected routes that require authentication
  const isAdminRoute = pathname.startsWith('/admin')
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isWarehouseRoute = pathname.startsWith('/warehouse')

  // If user is authenticated and tries to access auth pages, redirect to appropriate dashboard
  // BUT: Only redirect if not already on accept-invitation route (that needs to complete first)
  if (user && isAuthRoute && !pathname.startsWith('/accept-invitation/') && supabaseUrl && supabaseAnonKey) {
    // Get role from profile for more accurate role checking
    let userRole = user.user_metadata?.role || 'member'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role) {
        // Map legacy roles to new roles
        if (profile.role === 'super_admin') userRole = 'root'
        else if (profile.role === 'customer') userRole = 'member'
        else if (profile.role === 'worker') userRole = 'warehouse_staff'
        else if (['root', 'company_admin', 'member', 'warehouse_staff', 'owner'].includes(profile.role)) {
          userRole = profile.role
        }
      } else {
        // Fallback: map metadata role
        const metadataRole = user.user_metadata?.role as string
        if (metadataRole === 'super_admin') userRole = 'root'
        else if (metadataRole === 'customer') userRole = 'member'
        else if (metadataRole === 'worker') userRole = 'warehouse_staff'
        else if (['root', 'company_admin', 'member', 'warehouse_staff'].includes(metadataRole)) {
          userRole = metadataRole
        }
      }
    } catch (error) {
      // If profile fetch fails, use metadata role with mapping
      const metadataRole = user.user_metadata?.role as string
      if (metadataRole === 'super_admin') userRole = 'root'
      else if (metadataRole === 'customer') userRole = 'member'
      else if (metadataRole === 'worker') userRole = 'warehouse_staff'
      else if (['root', 'company_admin', 'member', 'warehouse_staff'].includes(metadataRole)) {
        userRole = metadataRole
      }
    }

    // Determine target route based on role
    let targetRoute = '/dashboard'
    if (userRole === 'root') {
      targetRoute = '/admin'
    } else if (userRole === 'warehouse_staff') {
      targetRoute = '/warehouse'
    } else if (['company_admin', 'member', 'owner'].includes(userRole)) {
      targetRoute = '/dashboard'
    }

    // Only redirect if we're not already going to the target route
    // This prevents redirect loops
    if (pathname !== targetRoute && !pathname.startsWith(targetRoute + '/')) {
      // Admin login page - redirect root to admin panel, others to their dashboard
      if (isAdminLoginRoute) {
        return NextResponse.redirect(new URL(targetRoute, request.url))
      }

      // Regular login/register pages - redirect to appropriate route
      return NextResponse.redirect(new URL(targetRoute, request.url))
    }
  }

  // Protected routes - require authentication
  if (!user && (isAdminRoute || isDashboardRoute || isWarehouseRoute)) {
    // Only redirect if not already on an auth route to prevent loops
    if (!isAuthRoute) {
      const loginPath = isAdminRoute ? '/admin-login' : '/login'
      const redirectUrl = new URL(loginPath, request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Role-based access control
  if (user) {
    // Get role from profile for more accurate role checking
    let userRole = user.user_metadata?.role || 'member'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role) {
        // Map legacy roles to new roles
        if (profile.role === 'super_admin') userRole = 'root'
        else if (profile.role === 'customer') userRole = 'member'
        else if (profile.role === 'worker') userRole = 'warehouse_staff'
        else if (['root', 'company_admin', 'member', 'warehouse_staff'].includes(profile.role)) {
          userRole = profile.role
        }
      } else {
        // Fallback: map metadata role
        const metadataRole = user.user_metadata?.role as string
        if (metadataRole === 'super_admin') userRole = 'root'
        else if (metadataRole === 'customer') userRole = 'member'
        else if (metadataRole === 'worker') userRole = 'warehouse_staff'
        else if (['root', 'company_admin', 'member', 'warehouse_staff'].includes(metadataRole)) {
          userRole = metadataRole
        }
      }
    } catch (error) {
      // If profile fetch fails, use metadata role with mapping
      const metadataRole = user.user_metadata?.role as string
      if (metadataRole === 'super_admin') userRole = 'root'
      else if (metadataRole === 'customer') userRole = 'member'
      else if (metadataRole === 'worker') userRole = 'warehouse_staff'
      else if (['root', 'company_admin', 'member', 'warehouse_staff'].includes(metadataRole)) {
        userRole = metadataRole
      }
    }

    // Admin routes - only root can access
    if (isAdminRoute && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Warehouse routes - only warehouse_staff can access
    if (isWarehouseRoute && userRole !== 'warehouse_staff') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Dashboard routes - company_admin, member, and owner can access
    if (isDashboardRoute && !['company_admin', 'member', 'owner'].includes(userRole)) {
      if (userRole === 'warehouse_staff') {
        return NextResponse.redirect(new URL('/warehouse', request.url))
      } else if (userRole === 'root') {
        return NextResponse.redirect(new URL('/admin', request.url))
      } else {
        // Unknown role or no role - redirect to appropriate route based on role
        // Don't redirect to /login as that would create a loop
        // Instead, redirect to a safe default or show error
        console.warn(`User ${user.id} with role "${userRole}" accessing dashboard route ${pathname}`)
        // Allow access - let the layout handle the error display
        // This prevents redirect loops
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
