import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/terms', '/privacy']
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))

  // Auth routes (login, register) - redirect if already authenticated
  const authRoutes = ['/login', '/register']
  const isAuthRoute = authRoutes.includes(pathname)

  // Protected routes that require authentication
  const adminRoutes = ['/admin']
  const dashboardRoutes = ['/dashboard']
  const workerRoutes = ['/worker']

  const isAdminRoute = pathname.startsWith('/admin')
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isWorkerRoute = pathname.startsWith('/worker')
  const isApiRoute = pathname.startsWith('/api')

  // If user is authenticated and tries to access auth pages, redirect to appropriate dashboard
  if (user && isAuthRoute) {
    const userRole = user.user_metadata?.role || 'customer'
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
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Role-based access control
  if (user) {
    const userRole = user.user_metadata?.role || 'customer'

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
