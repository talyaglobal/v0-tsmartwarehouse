import { type NextRequest, NextResponse } from "next/server"
import { getClaimById, updateClaim, deleteClaim } from "@/lib/db/claims"
import { handleApiError } from "@/lib/utils/logger"
import { updateClaimSchema } from "@/lib/validation/schemas"
import type { ClaimResponse, ErrorResponse, ApiResponse } from "@/types/api"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

