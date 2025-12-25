import { type NextRequest, NextResponse } from "next/server"
import { getClaimById, updateClaim, deleteClaim } from "@/lib/db/claims"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { updateClaimSchema } from "@/lib/validation/schemas"
import type { ClaimResponse, ErrorResponse, ApiResponse } from "@/types/api"

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
    const { user } = authResult

    const { id } = await params
    const claim = await getClaimById(id)

    if (!claim) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Claim not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check if user has access to this claim
    // Admin can see all claims, regular users can only see their own
    if (user.role !== 'super_admin' && claim.customerId !== user.id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Forbidden: You don't have access to this claim",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const responseData: ClaimResponse = {
      success: true,
      data: claim,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/claims/[id]" })
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
    
    // Check if user has access to this claim before updating
    const existingClaim = await getClaimById(id)
    if (!existingClaim) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Claim not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check access: Admin can update all claims, regular users can only update their own
    if (user.role !== 'super_admin' && existingClaim.customerId !== user.id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Forbidden: You don't have access to this claim",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const body = await request.json()

    // Validate with Zod schema
    const validatedData = updateClaimSchema.parse(body)

    const updatedClaim = await updateClaim(id, validatedData)

    const responseData: ClaimResponse = {
      success: true,
      data: updatedClaim,
      message: "Claim updated successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    // Handle Zod validation errors
    if (error && typeof error === "object" && "issues" in error) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Validation error",
        statusCode: 400,
        code: "VALIDATION_ERROR",
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const errorResponse = handleApiError(error, { path: "/api/v1/claims/[id]", method: "PATCH" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
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
    
    // Check if user has access to this claim before deleting
    const existingClaim = await getClaimById(id)
    if (!existingClaim) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Claim not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check access: Only admin can delete claims (based on RLS policy)
    if (user.role !== 'super_admin') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Forbidden: Only admins can delete claims",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    await deleteClaim(id)

    const responseData: ApiResponse = {
      success: true,
      message: "Claim deleted successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/claims/[id]", method: "DELETE" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

