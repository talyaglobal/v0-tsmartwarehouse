import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { applySecurityHeaders } from '@/lib/security/headers'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Beta protection check - enabled via BETA_PROTECTION_ENABLED env var
  const betaProtectionEnabled = process.env.BETA_PROTECTION_ENABLED === "true"
  
  if (betaProtectionEnabled) {
    // Public paths that don't require beta password
    const betaPublicPaths = ["/beta-login", "/api/beta-auth", "/api/v1/public", "/_next", "/favicon.ico"]
    const isBetaPublicPath = betaPublicPaths.some(path => pathname.startsWith(path))
    
    // Also allow static assets
    const isStaticAsset = pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
    
    if (!isBetaPublicPath && !isStaticAsset) {
      const betaAccess = request.cookies.get("beta-access")
      
      if (!betaAccess || betaAccess.value !== "granted") {
        return NextResponse.redirect(new URL("/beta-login", request.url))
      }
    }
  }

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
    const publicRoutes = ['/', '/login', '/admin-login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/terms', '/privacy', '/auth/callback', '/find-warehouses']
    // Public warehouse detail pages (e.g., /warehouse/[id] or /warehouses/[id])
    const isPublicWarehouseDetailRoute = (pathname.startsWith('/warehouse/') && pathname.match(/^\/warehouse\/[^\/]+$/)) || (pathname.startsWith('/warehouses/') && pathname.match(/^\/warehouses\/[^\/]+$/))
    const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/')) || isPublicWarehouseDetailRoute
    
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

  // Auth routes (login, register, admin-login, accept-invitation) - redirect if already authenticated
  const authRoutes = ['/login', '/register', '/admin-login']
  const isAuthRoute = authRoutes.includes(pathname) || pathname.startsWith('/accept-invitation/')
  const isAdminLoginRoute = pathname === '/admin-login'

  // Protected routes that require authentication
  const isAdminRoute = pathname.startsWith('/admin')
  const isDashboardRoute = pathname.startsWith('/dashboard')
  // Public warehouse detail pages (e.g., /warehouse/[id] or /warehouses/[id]) - accessible to everyone
  // Protected warehouse staff routes are under /warehouse (without ID) - handled separately
  const isPublicWarehouseDetailRoute = (pathname.startsWith('/warehouse/') && pathname.match(/^\/warehouse\/[^\/]+$/)) || (pathname.startsWith('/warehouses/') && pathname.match(/^\/warehouses\/[^\/]+$/))
  // Public warehouse review/booking pages (e.g., /warehouses/[id]/review) - accessible to everyone
  const isPublicWarehouseReviewRoute = pathname.match(/^\/warehouses\/[^\/]+\/review/)
  const isWarehouseRoute = pathname.startsWith('/warehouse') && !isPublicWarehouseDetailRoute && !isPublicWarehouseReviewRoute

  // If user is authenticated and tries to access auth pages, redirect to appropriate dashboard
  // BUT: Only redirect if not already on accept-invitation route (that needs to complete first)
  if (user && isAuthRoute && !pathname.startsWith('/accept-invitation/') && supabaseUrl && supabaseAnonKey) {
    // Check if there's a redirect parameter - if so, redirect directly to that page
    const redirectParam = request.nextUrl.searchParams.get('redirect')
    if (redirectParam) {
      // User is already authenticated and wants to go to a specific page
      // Redirect them directly to that page (they don't need to see login form)
      return NextResponse.redirect(new URL(redirectParam, request.url))
    }

    // Get role from profile for more accurate role checking
    let userRole = user.user_metadata?.role || 'customer'

    // Check for root user test role selector (cookie)
    const testRoleCookie = request.cookies.get('root-test-role')?.value

    // NEW ROLE SYSTEM (2026-01-11):
    // root, warehouse_admin (owner), warehouse_supervisor (manager), warehouse_client (customer),
    // warehouse_staff, warehouse_finder, warehouse_broker (reseller),
    // end_delivery_party, local_transport, international_transport
    
    const validRoles = [
      'root', 
      'warehouse_admin',       // Formerly warehouse_owner
      'warehouse_supervisor',  // Formerly warehouse_admin
      'warehouse_client',      // Formerly customer
      'warehouse_staff', 
      'warehouse_finder', 
      'warehouse_broker',      // Formerly reseller
      'end_delivery_party',    // NEW
      'local_transport',       // NEW
      'international_transport' // NEW
    ]
    
    // Legacy role mappings
    const legacyRoleMap: Record<string, string> = {
      'super_admin': 'root',
      'warehouse_owner': 'warehouse_admin',
      'company_owner': 'warehouse_admin',
      'warehouse_admin': 'warehouse_supervisor', // Note: old warehouse_admin -> warehouse_supervisor
      'customer': 'warehouse_client',
      'member': 'warehouse_client',
      'worker': 'warehouse_staff',
      'reseller': 'warehouse_broker',
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role) {
        // Map legacy roles to new roles, or use directly if already new role
        if (legacyRoleMap[profile.role]) {
          userRole = legacyRoleMap[profile.role]
        } else if (validRoles.includes(profile.role)) {
          userRole = profile.role
        }
      } else {
        // Fallback: map metadata role
        const metadataRole = user.user_metadata?.role as string
        if (legacyRoleMap[metadataRole]) {
          userRole = legacyRoleMap[metadataRole]
        } else if (validRoles.includes(metadataRole)) {
          userRole = metadataRole
        }
      }
    } catch (error) {
      // If profile fetch fails, use metadata role with mapping
      const metadataRole = user.user_metadata?.role as string
      if (legacyRoleMap[metadataRole]) {
        userRole = legacyRoleMap[metadataRole]
      } else if (validRoles.includes(metadataRole)) {
        userRole = metadataRole
      }
    }

    // If root user and test role is set, use test role instead (for admin role testing)
    const testableRoles = [
      'warehouse_admin', 'warehouse_supervisor', 'warehouse_client', 'warehouse_staff',
      'warehouse_finder', 'warehouse_broker', 'end_delivery_party', 'local_transport', 'international_transport'
    ]
    if (userRole === 'root' && testRoleCookie && testableRoles.includes(testRoleCookie)) {
      userRole = testRoleCookie as typeof userRole
    }

    // Determine target route based on role
    let targetRoute = '/dashboard'
    if (userRole === 'root') {
      targetRoute = '/admin'
    } else if (userRole === 'warehouse_staff') {
      targetRoute = '/warehouse'
    } else if (userRole === 'warehouse_finder') {
      targetRoute = '/dashboard/warehouse-finder'
    } else if (userRole === 'warehouse_broker') {
      targetRoute = '/dashboard/reseller'
    } else if (userRole === 'end_delivery_party') {
      targetRoute = '/dashboard/end-delivery'
    } else if (userRole === 'local_transport') {
      targetRoute = '/dashboard/local-transport'
    } else if (userRole === 'international_transport') {
      targetRoute = '/dashboard/international-transport'
    } else if (['warehouse_admin', 'warehouse_supervisor', 'warehouse_client'].includes(userRole)) {
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

  // Allow OAuth callback route (it handles its own auth)
  const isOAuthCallback = pathname === '/auth/callback'
  if (isOAuthCallback) {
    return response
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
    let userRole = user.user_metadata?.role || 'warehouse_client'
    
    // Check for root user test role selector (cookie)
    const testRoleCookie = request.cookies.get('root-test-role')?.value
    
    // NEW ROLE SYSTEM (2026-01-11)
    const validRoles = [
      'root', 
      'warehouse_admin',       // Formerly warehouse_owner
      'warehouse_supervisor',  // Formerly warehouse_admin
      'warehouse_client',      // Formerly customer
      'warehouse_staff', 
      'warehouse_finder', 
      'warehouse_broker',      // Formerly reseller
      'end_delivery_party',
      'local_transport',
      'international_transport'
    ]
    
    const legacyRoleMap: Record<string, string> = {
      'super_admin': 'root',
      'warehouse_owner': 'warehouse_admin',
      'company_owner': 'warehouse_admin',
      'warehouse_admin': 'warehouse_supervisor',
      'customer': 'warehouse_client',
      'member': 'warehouse_client',
      'worker': 'warehouse_staff',
      'reseller': 'warehouse_broker',
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.role) {
        if (legacyRoleMap[profile.role]) {
          userRole = legacyRoleMap[profile.role]
        } else if (validRoles.includes(profile.role)) {
          userRole = profile.role
        }
        
        // If root user and test role is set, use test role instead
        const testableRoles = validRoles.filter(r => r !== 'root')
        if (profile.role === 'root' && testRoleCookie && testableRoles.includes(testRoleCookie)) {
          userRole = testRoleCookie as typeof userRole
        }
      } else {
        const metadataRole = user.user_metadata?.role as string
        if (legacyRoleMap[metadataRole]) {
          userRole = legacyRoleMap[metadataRole]
        } else if (validRoles.includes(metadataRole)) {
          userRole = metadataRole
        }
        
        const testableRoles = validRoles.filter(r => r !== 'root')
        if (userRole === 'root' && testRoleCookie && testableRoles.includes(testRoleCookie)) {
          userRole = testRoleCookie as typeof userRole
        }
      }
    } catch (error) {
      const metadataRole = user.user_metadata?.role as string
      if (legacyRoleMap[metadataRole]) {
        userRole = legacyRoleMap[metadataRole]
      } else if (validRoles.includes(metadataRole)) {
        userRole = metadataRole
      }
      
      const testableRoles = validRoles.filter(r => r !== 'root')
      if (userRole === 'root' && testRoleCookie && testableRoles.includes(testRoleCookie)) {
        userRole = testRoleCookie as typeof userRole
      }
    }

    // Admin routes - only root can access (unless testing as root)
    if (isAdminRoute && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Warehouse routes - only warehouse_staff can access
    if (isWarehouseRoute && userRole !== 'warehouse_staff') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Warehouse Finder routes - only warehouse_finder can access
    const isWarehouseFinderRoute = pathname.startsWith('/dashboard/warehouse-finder')
    if (isWarehouseFinderRoute && userRole !== 'warehouse_finder' && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Warehouse Broker (reseller) routes - only warehouse_broker can access
    const isResellerRoute = pathname.startsWith('/dashboard/reseller')
    if (isResellerRoute && userRole !== 'warehouse_broker' && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // End Delivery Party routes
    const isEndDeliveryRoute = pathname.startsWith('/dashboard/end-delivery')
    if (isEndDeliveryRoute && userRole !== 'end_delivery_party' && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Local Transport routes
    const isLocalTransportRoute = pathname.startsWith('/dashboard/local-transport')
    if (isLocalTransportRoute && userRole !== 'local_transport' && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // International Transport routes
    const isInternationalTransportRoute = pathname.startsWith('/dashboard/international-transport')
    if (isInternationalTransportRoute && userRole !== 'international_transport' && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Dashboard routes - these roles can access dashboard
    const dashboardRoles = [
      'warehouse_admin', 'warehouse_supervisor', 'warehouse_client', 
      'warehouse_finder', 'warehouse_broker',
      'end_delivery_party', 'local_transport', 'international_transport'
    ]
    if (isDashboardRoute && !dashboardRoles.includes(userRole)) {
      if (userRole === 'warehouse_staff') {
        return NextResponse.redirect(new URL('/warehouse', request.url))
      } else if (userRole === 'root') {
        return NextResponse.redirect(new URL('/admin', request.url))
      } else {
        console.warn(`User ${user.id} with role "${userRole}" accessing dashboard route ${pathname}`)
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
