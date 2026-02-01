import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getTeamDetails, updateTeamWithValidation, deleteTeamWithValidation } from "@/lib/business-logic/teams"
import type { ApiResponse, ErrorResponse } from "@/types/api"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/v1/teams/[id]
 * Get team details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id } = await params
    const team = await getTeamDetails(id, authResult.userId)

    const responseData: ApiResponse = {
      success: true,
      data: team,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/teams/[id]" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * PATCH /api/v1/teams/[id]
 * Update team details
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id } = await params
    const body = await request.json()
    const { name, description } = body

    const updates: { name?: string; description?: string } = {}
    if (name !== undefined) updates.name = name.trim()
    if (description !== undefined) updates.description = description?.trim()

    const team = await updateTeamWithValidation(id, authResult.userId, updates)

    const responseData: ApiResponse = {
      success: true,
      data: team,
      message: "Team updated successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/teams/[id]", method: "PATCH" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * DELETE /api/v1/teams/[id]
 * Delete (soft) a team
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id } = await params
    await deleteTeamWithValidation(id, authResult.userId)

    const responseData: ApiResponse = {
      success: true,
      message: "Team deleted successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/teams/[id]", method: "DELETE" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
