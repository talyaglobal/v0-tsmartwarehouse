import { type NextRequest, NextResponse } from "next/server"
import { getAuditLogs } from "@/lib/db/audit"
import { handleApiError } from "@/lib/utils/logger"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { AuditLogsListResponse, ErrorResponse } from "@/types/api"
import type { AuditAction, AuditEntity } from "@/lib/audit/types"

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const entity = searchParams.get("entity") as AuditEntity | null
    const action = searchParams.get("action") as AuditAction | null
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined

    // Check user role
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "User profile not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    const filters: {
      companyId?: string
      entity?: AuditEntity
      action?: AuditAction
      startDate?: string
      endDate?: string
      limit?: number
      offset?: number
    } = {}

    // Root users can see all logs or filter by company
    if (profile.role === 'root') {
      if (companyId && companyId !== 'all') {
        filters.companyId = companyId
      }
    } else if (profile.role === 'warehouse_admin' || profile.role === 'warehouse_supervisor') {
      // Company admins can only see their own company's logs
      if (profile.company_id) {
        filters.companyId = profile.company_id
      } else {
        const errorData: ErrorResponse = {
          success: false,
          error: "User is not associated with a company",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    } else {
      const errorData: ErrorResponse = {
        success: false,
        error: "Unauthorized: Only root users and company admins can view audit logs",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    if (entity) filters.entity = entity
    if (action) filters.action = action
    if (startDate) filters.startDate = startDate
    if (endDate) filters.endDate = endDate
    if (limit) filters.limit = limit
    if (offset) filters.offset = offset

    const auditLogs = await getAuditLogs(filters)

    const responseData: AuditLogsListResponse = {
      success: true,
      data: auditLogs,
      total: auditLogs.length,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/audit-logs" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

