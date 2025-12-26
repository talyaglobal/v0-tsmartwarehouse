import { type NextRequest, NextResponse } from "next/server"
import { checkOutAccessLog } from "@/lib/db/access-logs"
import { handleApiError } from "@/lib/utils/logger"
import { requireAuth } from "@/lib/auth/api-middleware"
import type { AccessLogResponse, ErrorResponse } from "@/types/api"

export async function POST(
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
    const body = await request.json().catch(() => ({}))
    const exitTime = body.exitTime || new Date().toISOString()

    // Check out the access log
    const checkedOutLog = await checkOutAccessLog(id, exitTime, user.id)

    const responseData: AccessLogResponse = {
      success: true,
      data: checkedOutLog,
      message: "Visitor checked out successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const { id } = await params
    const errorResponse = handleApiError(error, { path: `/api/v1/access-logs/${id}/checkout`, method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

