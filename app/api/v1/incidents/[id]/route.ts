import { type NextRequest, NextResponse } from "next/server"
import { getIncidentById, updateIncident, deleteIncident } from "@/lib/db/incidents"
import { handleApiError } from "@/lib/utils/logger"
import { updateIncidentSchema } from "@/lib/validation/schemas"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const incident = await getIncidentById(id)

    if (!incident) {
      return NextResponse.json(
        { success: false, error: "Incident not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: incident,
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/incidents/[id]" })
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
    const validatedData = updateIncidentSchema.parse(body)

    const updatedIncident = await updateIncident(id, validatedData)

    return NextResponse.json({
      success: true,
      data: updatedIncident,
      message: "Incident updated successfully",
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

    return NextResponse.json({
      success: true,
      message: "Incident deleted successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/incidents/[id]", method: "DELETE" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

