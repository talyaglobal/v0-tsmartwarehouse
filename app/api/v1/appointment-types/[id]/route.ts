import { type NextRequest, NextResponse } from "next/server"
import { getAppointmentTypeById, updateAppointmentType, deleteAppointmentType } from "@/lib/db/appointment-types"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { updateAppointmentTypeSchema } from "@/lib/validation/schemas"
import type { ErrorResponse } from "@/types/api"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const appointmentType = await getAppointmentTypeById(resolvedParams.id)

    if (!appointmentType) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Appointment type not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: appointmentType,
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointment-types/[id]" })
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

    // Check if user is root admin
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'root') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Only root admin can update appointment types",
        statusCode: 403,
        code: "FORBIDDEN",
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const resolvedParams = params instanceof Promise ? await params : params
    const body = await request.json()

    // Validate request body
    let validatedData
    try {
      validatedData = updateAppointmentTypeSchema.parse(body)
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

    const appointmentType = await updateAppointmentType(resolvedParams.id, validatedData)

    return NextResponse.json({
      success: true,
      data: appointmentType,
      message: "Appointment type updated successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointment-types/[id]", method: "PUT" })
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

    // Check if user is root admin
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'root') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Only root admin can delete appointment types",
        statusCode: 403,
        code: "FORBIDDEN",
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const resolvedParams = params instanceof Promise ? await params : params
    await deleteAppointmentType(resolvedParams.id)

    return NextResponse.json({
      success: true,
      message: "Appointment type deleted successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointment-types/[id]", method: "DELETE" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

