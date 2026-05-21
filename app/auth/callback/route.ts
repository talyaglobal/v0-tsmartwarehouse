import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/kolaybase/client'

/**
 * OAuth Callback Handler
 *
 * This route handles the OAuth callback from providers (Google, etc.)
 * It exchanges the authorization code for a session and redirects the user
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const accessToken = requestUrl.searchParams.get('access_token')
  const refreshToken = requestUrl.searchParams.get('refresh_token')
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (accessToken && refreshToken) {
    // KolayBase returns tokens directly via query params
    const kolaybase = createClient()
    const { error } = await kolaybase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    if (!error) {
      const { data: { user } } = await kolaybase.auth.getUser()

      let redirectPath = '/dashboard'

      if (user) {
        const { data: profile } = await kolaybase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        const role = profile?.role || user.user_metadata?.role || 'warehouse_client'

        if (role === 'root' || role === 'super_admin') {
          redirectPath = '/admin'
        } else if (role === 'warehouse_staff' || role === 'worker') {
          redirectPath = '/warehouse'
        } else {
          redirectPath = '/dashboard'
        }
      }

      return NextResponse.redirect(`${origin}${redirectPath}`)
    }
  }

  if (code) {
    // If code-based flow, redirect to KolayBase auth endpoint to exchange
    const kolaybase = createClient()
    const { error } = await kolaybase.auth.setSession({
      access_token: code,
      refresh_token: '',
    })

    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // If authentication fails, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate`)
}
