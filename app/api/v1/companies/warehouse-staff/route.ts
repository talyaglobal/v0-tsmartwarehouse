import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/companies/warehouse-staff
 * Get all warehouse staff users in the authenticated user's company
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // Check if user is warehouse_owner (or owner), company_admin, or root
    const allowedRoles = ['warehouse_owner', 'owner', 'company_admin', 'root']
    if (!allowedRoles.includes(user.role)) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Unauthorized: Only warehouse owners, company admins, or root can view warehouse staff",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const supabase = createServerSupabaseClient()

    // Get user's company_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.company_id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "User is not associated with a company",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Get all warehouse_staff users in the same company
    const { data: warehouseStaff, error: staffError } = await supabase
      .from('profiles')
      .select('id, name, email, role, company_id')
      .eq('role', 'warehouse_staff')
      .eq('company_id', profile.company_id)

    if (staffError) {
      throw new Error(`Failed to fetch warehouse staff: ${staffError.message}`)
    }

    return NextResponse.json({
      success: true,
      data: warehouseStaff || [],
      total: warehouseStaff?.length || 0,
    })
  } catch (error) {
    console.error("Error fetching warehouse staff:", error)
    const errorResponse = handleApiError(error, { path: "/api/v1/companies/warehouse-staff" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

