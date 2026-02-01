import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getTeamMembersForBooking } from "@/lib/business-logic/teams"
import type { ApiResponse, ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/teams/booking-members
 * Get team members that the current user can book on behalf of
 * Only returns members if user is a team admin
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const members = await getTeamMembersForBooking(authResult.user.id)

    const responseData: ApiResponse = {
      success: true,
      data: members,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/teams/booking-members" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
