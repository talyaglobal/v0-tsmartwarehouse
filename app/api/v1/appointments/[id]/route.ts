import { type NextRequest, NextResponse } from "next/server"
import { getAppointmentById, updateAppointment, deleteAppointment } from "@/lib/db/appointments"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { updateAppointmentSchema } from "@/lib/validation/schemas"
import type { ErrorResponse } from "@/types/api"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const appointment = await getAppointmentById(resolvedParams.id)

    if (!appointment) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Appointment not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: appointment,
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointments/[id]" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function PUT(
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
      validatedData = updateAppointmentSchema.parse(body)
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

    // Check permissions - user must be creator or warehouse staff
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

    const canEdit = appointment.createdBy === user.id || 
                   profile?.role === 'warehouse_staff' || 
                   profile?.role === 'root'

    if (!canEdit) {
      const errorData: ErrorResponse = {
        success: false,
        error: "You don't have permission to update this appointment",
        statusCode: 403,
        code: "FORBIDDEN",
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const updatedAppointment = await updateAppointment(resolvedParams.id, validatedData)

    return NextResponse.json({
      success: true,
      data: updatedAppointment,
      message: "Appointment updated successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointments/[id]", method: "PUT" })
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

    const canDelete = appointment.createdBy === user.id || 
                     profile?.role === 'warehouse_staff' || 
                     profile?.role === 'root'

    if (!canDelete) {
      const errorData: ErrorResponse = {
        success: false,
        error: "You don't have permission to cancel this appointment",
        statusCode: 403,
        code: "FORBIDDEN",
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    await deleteAppointment(resolvedParams.id)

    return NextResponse.json({
      success: true,
      message: "Appointment cancelled successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointments/[id]", method: "DELETE" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

