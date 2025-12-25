import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const publicRoutes = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/terms',
    '/privacy',
  ]
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  ) || request.nextUrl.pathname === '/'

  // Redirect to login if not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && (request.nextUrl.pathname.startsWith('/login') || 
               request.nextUrl.pathname.startsWith('/register'))) {
    // Get user role to determine redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || user.user_metadata?.role || 'customer'
    
    const url = request.nextUrl.clone()
    if (role === 'super_admin') {
      url.pathname = '/admin'
    } else if (role === 'worker') {
      url.pathname = '/worker'
    } else {
      url.pathname = '/dashboard'
    }
    return NextResponse.redirect(url)
  }

  // Role-based route protection
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role || user.user_metadata?.role || 'customer'
    const pathname = request.nextUrl.pathname

    // Admin routes - only accessible by super admin
    if (pathname.startsWith('/admin') && role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Worker routes - only accessible by worker
    if (pathname.startsWith('/worker') && role !== 'worker') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Customer dashboard - accessible by customer and admin
    if (pathname.startsWith('/dashboard') && role === 'worker') {
      const url = request.nextUrl.clone()
      url.pathname = '/worker'
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely.

  return supabaseResponse
}

