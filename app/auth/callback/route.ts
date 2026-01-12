import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * OAuth Callback Handler
 * 
 * This route handles the OAuth callback from providers (Google, etc.)
 * It exchanges the authorization code for a session and redirects the user
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabaseResponse = NextResponse.next()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              supabaseResponse.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Get user to determine redirect based on role
      const { data: { user } } = await supabase.auth.getUser()
      
      // Default to dashboard for all users
      let redirectPath = '/dashboard'

      if (user) {
        // Get user role from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        const role = profile?.role || user.user_metadata?.role || 'warehouse_client'

        // Determine redirect based on role
        if (role === 'root' || role === 'super_admin') {
          redirectPath = '/admin'
        } else if (role === 'warehouse_staff' || role === 'worker') {
          redirectPath = '/warehouse'
        } else {
          // All other roles (customer, company_admin, company_owner) go to dashboard
          redirectPath = '/dashboard'
        }
      }

      // Redirect to the determined path with cookies
      return NextResponse.redirect(`${origin}${redirectPath}`, {
        headers: supabaseResponse.headers,
      })
    }
  }

  // If code exchange fails, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`)
}

