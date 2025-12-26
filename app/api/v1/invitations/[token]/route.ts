import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ApiResponse } from "@/types/api"

/**
 * GET /api/v1/invitations/[token]
 * Get invitation details by token
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Token is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Find profile with this invitation token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        name,
        role,
        invitation_token,
        invitation_expires_at,
        invitation_password,
        invited_by
      `)
      .eq('invitation_token', token)
      .maybeSingle()

    if (profileError || !profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invitation not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check if invitation is expired
    if (profile.invitation_expires_at) {
      const expiresAt = new Date(profile.invitation_expires_at)
      if (expiresAt < new Date()) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Invitation has expired",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
    }

    // Check if invitation is already accepted (has company_id)
    const { data: profileWithCompany } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', profile.id)
      .maybeSingle()

    if (profileWithCompany?.company_id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invitation has already been accepted",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Get inviter and company information
    let companyName = 'Company'
    if (profile.invited_by) {
      const { data: inviter } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', profile.invited_by)
        .maybeSingle()

      if (inviter?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('name')
          .eq('id', inviter.company_id)
          .maybeSingle()

        if (company) {
          companyName = company.name
        }
      }
    }

    const responseData: ApiResponse<any> = {
      success: true,
      data: {
        email: profile.email,
        name: profile.name,
        role: profile.role,
        companyName,
        invitationPassword: profile.invitation_password, // For auto-login
        expiresAt: profile.invitation_expires_at,
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
