import { type NextRequest, NextResponse } from "next/server"
import { getIncidentById, updateIncident, deleteIncident } from "@/lib/db/incidents"
import { handleApiError } from "@/lib/utils/logger"
import { updateIncidentSchema } from "@/lib/validation/schemas"
import type { IncidentResponse, ErrorResponse, ApiResponse } from "@/types/api"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const incident = await getIncidentById(id)

    if (!incident) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Incident not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    const responseData: IncidentResponse = {
      success: true,
      data: incident,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/incidents/[id]" })
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
    const validatedData = updateIncidentSchema.parse(body)

    const updatedIncident = await updateIncident(id, validatedData)

    const responseData: IncidentResponse = {
      success: true,
      data: updatedIncident,
      message: "Incident updated successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    // Handle Zod validation errors
    if (error && typeof error === "object" && "issues" in error) {
      const zodError = error as { issues: Array<{ path: string[]; message: string }> }
      const errorData: ErrorResponse = {
        success: false,
        error: "Validation error",
        statusCode: 400,
        code: "VALIDATION_ERROR",
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const errorResponse = handleApiError(error, { path: "/api/v1/incidents/[id]", method: "PATCH" })
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
    await deleteIncident(id)

    const responseData: ApiResponse = {
      success: true,
      message: "Incident deleted successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/incidents/[id]", method: "DELETE" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

