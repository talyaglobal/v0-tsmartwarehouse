import { type NextRequest, NextResponse } from "next/server"
import { getAppointments, createAppointment } from "@/lib/db/appointments"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { createAppointmentSchema, appointmentsQuerySchema } from "@/lib/validation/schemas"
import type { ErrorResponse } from "@/types/api"

export async function GET(request: NextRequest) {
  try {
    // Try to get authenticated user (optional for GET)
    const authResult = await requireAuth(request)
    let authenticatedUserId: string | undefined = undefined
    
    if (!(authResult instanceof NextResponse)) {
      authenticatedUserId = authResult.user.id
    }

    const { searchParams } = new URL(request.url)
    
    // Validate query parameters
    const queryParams: Record<string, string | undefined> = {}
    searchParams.forEach((value, key) => {
      queryParams[key] = value
    })

    let validatedParams
    try {
      validatedParams = appointmentsQuerySchema.parse(queryParams)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        const errorData: ErrorResponse = {
          success: false,
          error: "Invalid query parameters",
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: zodError.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", "),
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    const filters: Parameters<typeof getAppointments>[0] = {}

    // Check if user is warehouse staff
    let userRole: string | null = null
    let warehouseIds: string[] | null = null
    
    if (authenticatedUserId) {
      const { createServerSupabaseClient } = await import('@/lib/supabase/server')
      const supabase = createServerSupabaseClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authenticatedUserId)
        .single()
      
      userRole = profile?.role || null
      
      // If warehouse staff, get their assigned warehouses
      if (userRole === 'warehouse_staff') {
        const { getWarehouseStaffWarehouses } = await import('@/lib/business-logic/warehouse-staff')
        const warehouses = await getWarehouseStaffWarehouses(authenticatedUserId)
        warehouseIds = warehouses.map(w => w.warehouseId)
      }
    }

    // For warehouse staff, filter by their assigned warehouses
    if (warehouseIds && warehouseIds.length > 0) {
      // If specific warehouseId is provided, verify staff has access
      if (validatedParams.warehouseId) {
        if (!warehouseIds.includes(validatedParams.warehouseId)) {
          const errorData: ErrorResponse = {
            success: false,
            error: "You don't have access to this warehouse",
            statusCode: 403,
          }
          return NextResponse.json(errorData, { status: 403 })
        }
        filters.warehouseId = validatedParams.warehouseId
      } else {
        // For warehouse staff, filter by all assigned warehouses
        filters.warehouseIds = warehouseIds
      }
    } else {
      // For non-warehouse staff, use normal filtering
      if (validatedParams.warehouseId) filters.warehouseId = validatedParams.warehouseId
    }

    if (validatedParams.appointmentTypeId) filters.appointmentTypeId = validatedParams.appointmentTypeId
    if (validatedParams.status) filters.status = validatedParams.status
    if (validatedParams.startDate) filters.startDate = validatedParams.startDate
    if (validatedParams.endDate) filters.endDate = validatedParams.endDate
    if (validatedParams.createdBy) filters.createdBy = validatedParams.createdBy
    if (validatedParams.limit) filters.limit = validatedParams.limit
    if (validatedParams.offset) filters.offset = validatedParams.offset

    // If authenticated and no createdBy specified, default to user's appointments (only for non-warehouse staff)
    if (authenticatedUserId && !validatedParams.createdBy && userRole !== 'warehouse_staff') {
      filters.createdBy = authenticatedUserId
    }

    const appointments = await getAppointments(filters)

    return NextResponse.json({
      success: true,
      data: appointments,
      total: appointments.length,
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointments" })
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

    const body = await request.json()

    // Validate request body
    let validatedData
    try {
      validatedData = createAppointmentSchema.parse(body)
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

    const appointment = await createAppointment({
      ...validatedData,
      createdBy: user.id,
    })

    return NextResponse.json({
      success: true,
      data: appointment,
      message: "Appointment created successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/appointments", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

