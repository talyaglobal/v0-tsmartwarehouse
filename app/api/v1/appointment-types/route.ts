import { type NextRequest, NextResponse } from "next/server"
import { getAppointmentTypes, createAppointmentType } from "@/lib/db/appointment-types"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { createAppointmentTypeSchema } from "@/lib/validation/schemas"
import type { ErrorResponse } from "@/types/api"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const appointmentTypes = await getAppointmentTypes(includeInactive)

    return NextResponse.json({
      success: true,
      data: appointmentTypes,
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointment-types" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function POST(request: NextRequest) {
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
        error: "Only root admin can create appointment types",
        statusCode: 403,
        code: "FORBIDDEN",
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const body = await request.json()

    // Validate request body
    let validatedData
    try {
      validatedData = createAppointmentTypeSchema.parse(body)
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

    const appointmentType = await createAppointmentType({
      ...validatedData,
      createdBy: user.id,
    })

    return NextResponse.json({
      success: true,
      data: appointmentType,
      message: "Appointment type created successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointment-types", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

