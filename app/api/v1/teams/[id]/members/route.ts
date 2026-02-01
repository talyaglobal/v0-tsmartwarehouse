import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getTeamMembers } from "@/lib/db/teams"
import { addMemberWithValidation, isTeamMember } from "@/lib/business-logic/teams"
import type { ApiResponse, ErrorResponse } from "@/types/api"
import type { TeamRole } from "@/types"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/v1/teams/[id]/members
 * Get team members
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id } = await params

    // Check if user is a member of this team
    const isMember = await isTeamMember(id, authResult.user.id)
    if (!isMember) {
      const errorData: ErrorResponse = {
        success: false,
        error: "You do not have permission to view this team's members",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const members = await getTeamMembers(id)

    const responseData: ApiResponse = {
      success: true,
      data: members,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/teams/[id]/members" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * POST /api/v1/teams/[id]/members
 * Add a member to the team
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id } = await params
    const body = await request.json()
    const { memberId, role = "member" } = body

    if (!memberId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Member ID is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (role !== "admin" && role !== "member") {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Role must be "admin" or "member"',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const result = await addMemberWithValidation({
      teamId: id,
      memberId,
      role: role as TeamRole,
      invitedBy: authResult.user.id,
    })

    const responseData: ApiResponse = {
      success: true,
      data: result.member,
      message: result.message,
    }
    return NextResponse.json(responseData, { status: 201 })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/teams/[id]/members", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
