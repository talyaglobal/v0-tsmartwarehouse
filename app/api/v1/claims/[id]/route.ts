import { type NextRequest, NextResponse } from "next/server"
import { getClaimById, updateClaim, deleteClaim } from "@/lib/db/claims"
import { handleApiError } from "@/lib/utils/logger"
import { updateClaimSchema } from "@/lib/validation/schemas"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const claim = await getClaimById(id)

    if (!claim) {
      return NextResponse.json(
        { success: false, error: "Claim not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: claim,
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/claims/[id]" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
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

    return NextResponse.json({
      success: true,
      data: updatedClaim,
      message: "Claim updated successfully",
    })
  } catch (error) {
    // Handle Zod validation errors
    if (error && typeof error === "object" && "issues" in error) {
      const zodError = error as { issues: Array<{ path: string[]; message: string }> }
      return NextResponse.json(
        { 
          success: false, 
          error: "Validation error", 
          details: zodError.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", ")
        },
        { status: 400 }
      )
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
    const { id } = await params
    await deleteClaim(id)

    return NextResponse.json({
      success: true,
      message: "Claim deleted successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/claims/[id]", method: "DELETE" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

