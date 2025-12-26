import { type NextRequest, NextResponse } from "next/server"
import { getAccessLogById, updateAccessLog, deleteAccessLog } from "@/lib/db/access-logs"
import { handleApiError } from "@/lib/utils/logger"
import { requireAuth } from "@/lib/auth/api-middleware"
import { updateAccessLogSchema } from "@/lib/validation/schemas"
import type { AccessLogResponse, ErrorResponse } from "@/types/api"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id } = await params
    const accessLog = await getAccessLogById(id)

    if (!accessLog) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Access log not found",
        statusCode: 404,
        code: "NOT_FOUND",
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    const responseData: AccessLogResponse = {
      success: true,
      data: accessLog,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const { id } = await params
    const errorResponse = handleApiError(error, { path: `/api/v1/access-logs/${id}` })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { id } = await params
    const body = await request.json()

    // Validate with Zod schema
    let validatedData
    try {
      validatedData = updateAccessLogSchema.parse(body)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Validation error",
          statusCode: 400,
          code: "VALIDATION_ERROR",
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    // If checking out, set checkedOutBy
    // Note: status field in AccessLog type refers to access_log_status column
    if (validatedData.status === "checked_out" && !validatedData.checkedOutBy) {
      validatedData.checkedOutBy = user.id
    }

    const updatedAccessLog = await updateAccessLog(id, validatedData)

    const responseData: AccessLogResponse = {
      success: true,
      data: updatedAccessLog,
      message: "Access log updated successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const { id } = await params
    const errorResponse = handleApiError(error, { path: `/api/v1/access-logs/${id}`, method: "PATCH" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { id } = await params

    // Check if user is admin (deletion restricted to admins)
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'root')) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Unauthorized: Only admins can delete access logs",
        statusCode: 403,
        code: "FORBIDDEN",
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    await deleteAccessLog(id)

    const responseData = {
      success: true,
      message: "Access log deleted successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const { id } = await params
    const errorResponse = handleApiError(error, { path: `/api/v1/access-logs/${id}`, method: "DELETE" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

