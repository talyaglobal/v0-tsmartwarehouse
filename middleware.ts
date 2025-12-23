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

  // Auth routes (login, register, admin-login) - redirect if already authenticated
  const authRoutes = ['/login', '/register', '/admin-login']
  const isAuthRoute = authRoutes.includes(pathname)
  const isAdminLoginRoute = pathname === '/admin-login'

  // Protected routes that require authentication
  const isAdminRoute = pathname.startsWith('/admin')
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isWorkerRoute = pathname.startsWith('/worker')

  // If user is authenticated and tries to access auth pages, redirect to appropriate dashboard
  if (user && isAuthRoute && supabaseUrl && supabaseAnonKey) {
    // Get role from profile for more accurate role checking
    let userRole = user.user_metadata?.role || 'customer'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role) {
        userRole = profile.role
      }
    } catch (error) {
      // If profile fetch fails, use metadata role
    }

    // Admin login page - redirect admins to admin panel, others to their dashboard
    if (isAdminLoginRoute) {
      if (userRole === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url))
      } else {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    // Regular login/register pages
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    } else if (userRole === 'worker') {
      return NextResponse.redirect(new URL('/worker', request.url))
    } else {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Protected routes - require authentication
  if (!user && (isAdminRoute || isDashboardRoute || isWorkerRoute)) {
    // Redirect admin routes to admin login, others to regular login
    const loginPath = isAdminRoute ? '/admin-login' : '/login'
    const redirectUrl = new URL(loginPath, request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Role-based access control
  if (user) {
    // Get role from profile for more accurate role checking
    let userRole = user.user_metadata?.role || 'customer'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role) {
        userRole = profile.role
      }
    } catch (error) {
      // If profile fetch fails, use metadata role
    }

    // Admin routes - only admins can access
    if (isAdminRoute && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Worker routes - only workers can access
    if (isWorkerRoute && userRole !== 'worker') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Dashboard routes - customers and admins can access
    if (isDashboardRoute && !['customer', 'admin'].includes(userRole)) {
      return NextResponse.redirect(new URL('/worker', request.url))
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
