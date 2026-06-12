import { NextResponse, type NextRequest } from 'next/server'
import { applySecurityHeaders } from '@/lib/security/headers'

function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function getUserFromCookie(request: NextRequest): { id: string; email: string } | null {
  const token = request.cookies.get('kb_access_token')?.value
  if (!token) return null

  const claims = parseJwtPayload(token)
  if (!claims?.sub) return null
  if (claims.exp && claims.exp * 1000 < Date.now()) return null

  return {
    id: claims.sub,
    email: claims.email || claims.preferred_username || '',
  }
}

const VALID_ROLES = [
  'root',
  'warehouse_admin',
  'warehouse_supervisor',
  'warehouse_client',
  'warehouse_staff',
  'warehouse_finder',
  'warehouse_broker',
  'end_delivery_party',
  'local_transport',
  'international_transport',
]

const LEGACY_ROLE_MAP: Record<string, string> = {
  'super_admin': 'root',
  'warehouse_owner': 'warehouse_admin',
  'company_owner': 'warehouse_admin',
  'customer': 'warehouse_client',
  'member': 'warehouse_client',
  'worker': 'warehouse_staff',
  'reseller': 'warehouse_broker',
}

function resolveRole(rawRole: string | undefined | null): string {
  if (!rawRole) return 'warehouse_client'
  if (LEGACY_ROLE_MAP[rawRole]) return LEGACY_ROLE_MAP[rawRole]
  if (VALID_ROLES.includes(rawRole)) return rawRole
  return 'warehouse_client'
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const betaProtectionEnabled = process.env.BETA_PROTECTION_ENABLED === "true"

  if (betaProtectionEnabled) {
    const betaPublicPaths = ["/beta-login", "/api/beta-auth", "/api/v1/public", "/api/v1/companies/search", "/_next", "/favicon.ico"]
    const isBetaPublicPath = betaPublicPaths.some(path => pathname.startsWith(path))
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

  response = applySecurityHeaders(response, {
    strictTransportSecurity: process.env.NODE_ENV === 'production',
  })

  const user = getUserFromCookie(request)

  const authRoutes = ['/login', '/register', '/admin-login']
  const isAuthRoute = authRoutes.includes(pathname) || pathname.startsWith('/accept-invitation/')

  const isAdminRoute = pathname.startsWith('/admin')
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isPublicWarehouseDetailRoute = (pathname.startsWith('/warehouse/') && pathname.match(/^\/warehouse\/[^\/]+$/)) || (pathname.startsWith('/warehouses/') && pathname.match(/^\/warehouses\/[^\/]+$/))
  const isPublicWarehouseReviewRoute = pathname.match(/^\/warehouses\/[^\/]+\/review/)
  const isWarehouseRoute = pathname.startsWith('/warehouse') && !isPublicWarehouseDetailRoute && !isPublicWarehouseReviewRoute

  if (user && isAuthRoute && !pathname.startsWith('/accept-invitation/')) {
    const redirectParam = request.nextUrl.searchParams.get('redirect')
    if (redirectParam) {
      return NextResponse.redirect(new URL(redirectParam, request.url))
    }

    const rawRole = request.cookies.get('kb_user_role')?.value
    let userRole = resolveRole(rawRole)

    const testRoleCookie = request.cookies.get('root-test-role')?.value
    const testableRoles = VALID_ROLES.filter(r => r !== 'root')
    if (userRole === 'root' && testRoleCookie && testableRoles.includes(testRoleCookie)) {
      userRole = testRoleCookie
    }

    let targetRoute = '/dashboard'
    if (userRole === 'root') {
      targetRoute = '/admin'
    } else if (userRole === 'warehouse_staff') {
      targetRoute = '/warehouse'
    }

    if (pathname !== targetRoute && !pathname.startsWith(targetRoute + '/')) {
      return NextResponse.redirect(new URL(targetRoute, request.url))
    }
  }

  const isOAuthCallback = pathname === '/auth/callback'
  if (isOAuthCallback) {
    return response
  }

  if (!user && (isAdminRoute || isDashboardRoute || isWarehouseRoute)) {
    if (!isAuthRoute) {
      const loginPath = isAdminRoute ? '/admin-login' : '/login'
      const redirectUrl = new URL(loginPath, request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  if (user) {
    const rawRole = request.cookies.get('kb_user_role')?.value
    let userRole = resolveRole(rawRole)

    const testRoleCookie = request.cookies.get('root-test-role')?.value
    const testableRoles = VALID_ROLES.filter(r => r !== 'root')
    if (userRole === 'root' && testRoleCookie && testableRoles.includes(testRoleCookie)) {
      userRole = testRoleCookie
    }

    if (isAdminRoute && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (isWarehouseRoute && userRole !== 'warehouse_staff') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    const isWarehouseFinderRoute = pathname.startsWith('/dashboard/warehouse-finder')
    if (isWarehouseFinderRoute && userRole !== 'warehouse_finder' && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    const isBrokerRoute = pathname.startsWith('/dashboard/broker')
    if (isBrokerRoute && userRole !== 'warehouse_broker' && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    const isEndDeliveryRoute = pathname.startsWith('/dashboard/end-delivery')
    if (isEndDeliveryRoute && userRole !== 'end_delivery_party' && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    const isLocalTransportRoute = pathname.startsWith('/dashboard/local-transport')
    if (isLocalTransportRoute && userRole !== 'local_transport' && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    const isInternationalTransportRoute = pathname.startsWith('/dashboard/international-transport')
    if (isInternationalTransportRoute && userRole !== 'international_transport' && userRole !== 'root') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    const dashboardRoles = [
      'root',
      'warehouse_admin', 'warehouse_supervisor', 'warehouse_client',
      'warehouse_finder', 'warehouse_broker',
      'end_delivery_party', 'local_transport', 'international_transport',
    ]
    if (isDashboardRoute && !dashboardRoles.includes(userRole)) {
      if (userRole === 'warehouse_staff') {
        return NextResponse.redirect(new URL('/warehouse', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
