import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { removeMemberWithValidation, updateMemberRoleWithValidation } from "@/lib/business-logic/teams"
import type { ApiResponse, ErrorResponse } from "@/types/api"
import type { TeamRole } from "@/types"

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>
}

/**
 * PATCH /api/v1/teams/[id]/members/[memberId]
 * Update member role
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id, memberId } = await params
    const body = await request.json()
    const { role } = body

    if (!role || (role !== "admin" && role !== "member")) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Role must be "admin" or "member"',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const member = await updateMemberRoleWithValidation(
      id,
      memberId,
      role as TeamRole,
      authResult.userId
    )

    const responseData: ApiResponse = {
      success: true,
      data: member,
      message: `Member role updated to ${role}`,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, {
      path: "/api/v1/teams/[id]/members/[memberId]",
      method: "PATCH",
    })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * DELETE /api/v1/teams/[id]/members/[memberId]
 * Remove a member from the team
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id, memberId } = await params

    await removeMemberWithValidation(id, memberId, authResult.userId)

    const responseData: ApiResponse = {
      success: true,
      message: "Member removed from team",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, {
      path: "/api/v1/teams/[id]/members/[memberId]",
      method: "DELETE",
    })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
