import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getPendingBookingApprovals } from "@/lib/business-logic/bookings"
import { getApprovals, getApprovalStats } from "@/lib/db/booking-approvals"
import type { ApiResponse, ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/bookings/approvals
 * Get booking approvals for the current user
 * - pending: approvals waiting for user to approve (as customer)
 * - requested: approvals user requested (as team admin)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "pending"

    let approvals
    if (type === "pending") {
      // Get approvals waiting for user to approve
      approvals = await getPendingBookingApprovals(authResult.userId)
    } else if (type === "requested") {
      // Get approvals user has requested
      approvals = await getApprovals({ requestedBy: authResult.userId })
    } else {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Type must be "pending" or "requested"',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Get stats as well
    const stats = await getApprovalStats(authResult.userId)

    const responseData: ApiResponse = {
      success: true,
      data: {
        approvals,
        stats,
      },
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/bookings/approvals" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
