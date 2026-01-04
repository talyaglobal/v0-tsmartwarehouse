import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/users/me
 * Get current authenticated user information
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult

    // Get user profile with additional information
    const supabase = createServerSupabaseClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, first_name, last_name, role, company_id, membership_tier, credit_balance, avatar_url')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Error fetching user profile:", profileError)
    }

    // Get user from auth (for email if not in profile)
    const { data: { user: authUser } } = await supabase.auth.getUser()

    const userData = {
      id: user.id,
      email: profile?.email || authUser?.email || '',
      name: profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || authUser?.email?.split('@')[0] || 'User',
      role: profile?.role || 'customer',
      companyId: profile?.company_id || null,
      membershipTier: profile?.membership_tier || 'bronze',
      creditBalance: parseFloat(profile?.credit_balance || '0') || 0,
      avatar: profile?.avatar_url || null,
    }

    return NextResponse.json({
      success: true,
      data: userData,
    })
  } catch (error) {
    console.error("Error fetching user:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch user",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

