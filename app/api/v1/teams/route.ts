import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getCompanyTeams, createTeamWithValidation, getUserTeams } from "@/lib/business-logic/teams"
import type { ApiResponse, ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/teams
 * Get teams for the current user's company or user's teams
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const myTeams = searchParams.get("myTeams") === "true"

    let teams
    if (myTeams) {
      // Get teams the user is a member of
      teams = await getUserTeams(authResult.user.id)
    } else if (companyId) {
      // Get all teams in a company (requires permission)
      teams = await getCompanyTeams(companyId, authResult.user.id)
    } else {
      // Default to user's teams
      teams = await getUserTeams(authResult.user.id)
    }

    const responseData: ApiResponse = {
      success: true,
      data: teams,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/teams" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * POST /api/v1/teams
 * Create a new team
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const { name, description, companyId } = body

    if (!name || typeof name !== "string" || name.trim() === "") {
      const errorData: ErrorResponse = {
        success: false,
        error: "Team name is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (!companyId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Company ID is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const result = await createTeamWithValidation({
      name: name.trim(),
      description: description?.trim(),
      companyId,
      createdBy: authResult.user.id,
    })

    const responseData: ApiResponse = {
      success: true,
      data: result.team,
      message: result.message,
    }
    return NextResponse.json(responseData, { status: 201 })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/teams", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
