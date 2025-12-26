import { type NextRequest, NextResponse } from "next/server"
import { getAccessLogs, createAccessLog } from "@/lib/db/access-logs"
import { handleApiError } from "@/lib/utils/logger"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createAccessLogSchema, accessLogsQuerySchema } from "@/lib/validation/schemas"
import type { AccessLogVisitorType, AccessLogStatus } from "@/types"
import type { AccessLogsListResponse, AccessLogResponse, ErrorResponse } from "@/types/api"

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { searchParams } = new URL(request.url)
    
    // Validate query parameters
    const queryParams: Record<string, string | undefined> = {}
    searchParams.forEach((value, key) => {
      queryParams[key] = value
    })

    let validatedParams
    try {
      validatedParams = accessLogsQuerySchema.parse(queryParams)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Invalid query parameters",
          statusCode: 400,
          code: "VALIDATION_ERROR",
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    const filters: {
      visitorType?: AccessLogVisitorType
      warehouseId?: string
      status?: AccessLogStatus
      personId?: string
      bookingId?: string
      startDate?: string
      endDate?: string
      search?: string
      limit?: number
      offset?: number
    } = {}

    if (validatedParams.visitorType) filters.visitorType = validatedParams.visitorType
    if (validatedParams.warehouseId) filters.warehouseId = validatedParams.warehouseId
    if (validatedParams.status) filters.status = validatedParams.status
    if (validatedParams.personId) filters.personId = validatedParams.personId
    if (validatedParams.bookingId) filters.bookingId = validatedParams.bookingId
    if (validatedParams.startDate) filters.startDate = validatedParams.startDate
    if (validatedParams.endDate) filters.endDate = validatedParams.endDate
    if (validatedParams.search) filters.search = validatedParams.search
    if (validatedParams.limit) filters.limit = validatedParams.limit
    if (validatedParams.offset) filters.offset = validatedParams.offset

    const accessLogs = await getAccessLogs(filters)

    const responseData: AccessLogsListResponse = {
      success: true,
      data: accessLogs,
      total: accessLogs.length,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/access-logs" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const body = await request.json()

    // Validate with Zod schema
    let validatedData
    try {
      validatedData = createAccessLogSchema.parse(body)
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

    // Set entry time to now if not provided
    const entryTime = validatedData.entryTime || new Date().toISOString()

    // Create access log
    const newAccessLog = await createAccessLog({
      ...validatedData,
      entryTime,
      checkedInBy: validatedData.checkedInBy || user.id,
    })

    const responseData: AccessLogResponse = {
      success: true,
      data: newAccessLog,
      message: "Access log created successfully",
    }
    return NextResponse.json(responseData, { status: 201 })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/access-logs", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

