import { type NextRequest, NextResponse } from "next/server"
import { getBookings, createBooking } from "@/lib/db/bookings"
import { PRICING } from "@/lib/constants"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { setCacheHeaders } from "@/lib/cache/api-cache"
import { createBookingSchema, bookingsQuerySchema } from "@/lib/validation/schemas"
import type { BookingStatus, BookingType } from "@/types"
import type { BookingsListResponse, BookingResponse, ErrorResponse } from "@/types/api"

// Enable caching for GET requests (5 minutes)
export const revalidate = 300

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Validate query parameters
    const queryParams: Record<string, string | undefined> = {}
    searchParams.forEach((value, key) => {
      queryParams[key] = value
    })

    let validatedParams
    try {
      validatedParams = bookingsQuerySchema.parse(queryParams)
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

    const filters: {
      customerId?: string
      status?: BookingStatus
      type?: BookingType
      warehouseId?: string
      limit?: number
      offset?: number
    } = {}

    if (validatedParams.customerId) filters.customerId = validatedParams.customerId
    if (validatedParams.status) filters.status = validatedParams.status
    if (validatedParams.type) filters.type = validatedParams.type
    if (validatedParams.warehouseId) filters.warehouseId = validatedParams.warehouseId
    if (validatedParams.limit) filters.limit = validatedParams.limit
    if (validatedParams.offset) filters.offset = validatedParams.offset

    const bookings = await getBookings(filters)

    const responseData: BookingsListResponse = {
      success: true,
      data: bookings,
      total: bookings.length,
    }

    const response = NextResponse.json(responseData)

    // Set cache headers
    return setCacheHeaders(response, 300, 60)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/bookings" })
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

    // Validate request body with Zod schema
    let validatedData
    try {
      validatedData = createBookingSchema.parse(body)
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

    const { type, palletCount, areaSqFt, hallId, startDate, endDate, notes } = validatedData

    // Get customer profile information
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "User profile not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Calculate pricing
    let totalAmount = 0
    if (type === "pallet" && palletCount) {
      const handlingIn = palletCount * PRICING.palletIn
      const storage = palletCount * PRICING.storagePerPalletPerMonth
      totalAmount = handlingIn + storage
    } else if (type === "area-rental" && areaSqFt) {
      if (areaSqFt < PRICING.areaRentalMinSqFt) {
        const errorData: ErrorResponse = {
          success: false,
          error: `Minimum area rental is ${PRICING.areaRentalMinSqFt} sq ft`,
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      totalAmount = areaSqFt * PRICING.areaRentalPerSqFtPerYear
    }

    // Get default warehouse ID from environment or use first available
    const defaultWarehouseId = process.env.DEFAULT_WAREHOUSE_ID || body.warehouseId || "wh-001"

    // Create booking using database function
    const newBooking = await createBooking({
      customerId: user.id,
      customerName: profile.name || user.email,
      customerEmail: profile.email || user.email,
      warehouseId: defaultWarehouseId,
      type,
      status: "pending",
      palletCount: type === "pallet" ? palletCount : undefined,
      areaSqFt: type === "area-rental" ? areaSqFt : undefined,
      floorNumber: type === "area-rental" ? 3 : undefined,
      hallId: type === "area-rental" ? hallId : undefined,
      startDate,
      endDate: endDate || undefined,
      totalAmount,
      notes: notes || undefined,
    })

    const responseData: BookingResponse = {
      success: true,
      data: newBooking,
      message: "Booking created successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/bookings", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
