import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ApiResponse } from "@/types/api"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult
    const { id: companyId, invitationId } = await params

    // Check if user has permission
    if (user.role !== 'root') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (userCompanyId !== companyId) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: You don't have permission to delete this company's invitations",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
      
      const isAdmin = await isCompanyAdmin(user.id, companyId)
      if (!isAdmin) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: Only company admins can delete company invitations",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    }

    const supabaseAdmin = createServerSupabaseClient()
    
    // Verify invitation belongs to this company (invitationId is now profile ID)
    // Check invitation by verifying that the inviter's company matches
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, invitation_token, invited_by')
      .eq('id', invitationId)
      .not('invitation_token', 'is', null)
      .maybeSingle()

    if (profileError || !profile || !profile.invited_by) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invitation not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Verify that the inviter belongs to the requested company
    const { data: inviter, error: inviterError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id')
      .eq('id', profile.invited_by)
      .eq('company_id', companyId)
      .maybeSingle()

    if (inviterError || !inviter) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invitation not found or doesn't belong to this company",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Clear invitation fields from profile
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        invitation_token: null,
        invitation_expires_at: null,
        invitation_password: null,
        invited_by: null,
      })
      .eq('id', invitationId)

    if (error) {
      throw new Error(`Failed to delete invitation: ${error.message}`)
    }

    const responseData: ApiResponse = {
      success: true,
      message: "Invitation deleted successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/companies/[id]/invitations/[invitationId]", method: "DELETE" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
