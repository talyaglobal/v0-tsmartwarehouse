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
    if (user.role !== 'super_admin') {
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
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, invitation_company_id, invitation_token')
      .eq('id', invitationId)
      .eq('invitation_company_id', companyId)
      .not('invitation_token', 'is', null)
      .maybeSingle()

    if (profileError || !profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invitation not found",
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
        invitation_company_id: null,
        invitation_role: null,
        invitation_password: null,
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
