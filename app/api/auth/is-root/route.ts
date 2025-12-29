import { NextResponse } from 'next/server'
import { createAuthenticatedSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createAuthenticatedSupabaseClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ isRoot: false })
    }

    // Fetch profile role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ isRoot: false })
    }

    const role = profile?.role ?? (user.user_metadata?.role as string | undefined)
    const isRoot = role === 'root' || role === 'super_admin'

    return NextResponse.json({ isRoot })
  } catch (error) {
    console.error('is-root error', error)
    return NextResponse.json({ isRoot: false })
  }
}
