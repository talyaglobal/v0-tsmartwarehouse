import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ApiResponse } from "@/types/api"

/**
 * GET /api/v1/invitations/[token]
 * Get invitation details by token (public endpoint for pre-filling registration form)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = createServerSupabaseClient()
    const supabaseAdmin = createServerSupabaseClient({ admin: true })
    
    // Find profile with this invitation token
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        email,
        name,
        invitation_token,
        invitation_expires_at,
        invitation_password,
        company_id,
        role,
        companies(name)
      `)
      .eq('invitation_token', token)
      .maybeSingle()

    if (error || !profile || !profile.invitation_token) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invitation not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check if expired
    if (profile.invitation_expires_at && new Date(profile.invitation_expires_at) < new Date()) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invitation has expired",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Check if already accepted (if invitation_token is null, invitation was accepted)
    // Since we already filtered by invitation_token, if we got here, invitation is still pending

    const companyName = profile.companies 
      ? (Array.isArray(profile.companies) ? profile.companies[0]?.name : profile.companies?.name)
      : null

    const responseData: ApiResponse = {
      success: true,
      data: {
        email: profile.email,
        fullName: profile.name || profile.email.split('@')[0],
        companyId: profile.company_id, // Will be NULL for pending invitations
        companyName,
        role: profile.role || 'member',
        password: profile.invitation_password || null, // Include password for auto-login
      },
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/invitations/[token]", method: "GET" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
