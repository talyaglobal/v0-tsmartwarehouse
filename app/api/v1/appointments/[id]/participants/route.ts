import { type NextRequest, NextResponse } from "next/server"
import { getAppointmentById, addParticipant, removeParticipant } from "@/lib/db/appointments"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { addParticipantSchema } from "@/lib/validation/schemas"
import type { ErrorResponse } from "@/types/api"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const resolvedParams = params instanceof Promise ? await params : params
    const body = await request.json()

    // Validate request body
    let validatedData
    try {
      validatedData = addParticipantSchema.parse(body)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        const errorData: ErrorResponse = {
          success: false,
          error: "Validation error",
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: zodError.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", "),
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    // Check permissions
    const appointment = await getAppointmentById(resolvedParams.id)
    if (!appointment) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Appointment not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const canAddParticipant = appointment.createdBy === user.id || 
                              profile?.role === 'warehouse_staff' || 
                              profile?.role === 'root'

    if (!canAddParticipant) {
      const errorData: ErrorResponse = {
        success: false,
        error: "You don't have permission to add participants to this appointment",
        statusCode: 403,
        code: "FORBIDDEN",
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const participant = await addParticipant(
      resolvedParams.id,
      validatedData.userId,
      validatedData.role
    )

    return NextResponse.json({
      success: true,
      data: participant,
      message: "Participant added successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointments/[id]/participants", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const resolvedParams = params instanceof Promise ? await params : params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "userId query parameter is required",
        statusCode: 400,
        code: "VALIDATION_ERROR",
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Check permissions
    const appointment = await getAppointmentById(resolvedParams.id)
    if (!appointment) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Appointment not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // User can remove themselves or creator/staff can remove anyone
    const canRemove = userId === user.id ||
                     appointment.createdBy === user.id || 
                     profile?.role === 'warehouse_staff' || 
                     profile?.role === 'root'

    if (!canRemove) {
      const errorData: ErrorResponse = {
        success: false,
        error: "You don't have permission to remove this participant",
        statusCode: 403,
        code: "FORBIDDEN",
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    await removeParticipant(resolvedParams.id, userId)

    return NextResponse.json({
      success: true,
      message: "Participant removed successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointments/[id]/participants", method: "DELETE" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

