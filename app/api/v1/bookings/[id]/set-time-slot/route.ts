import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getBookingById } from "@/lib/db/bookings"
import { setBookingTimeSlot } from "@/lib/business-logic/bookings"
import type { ErrorResponse } from "@/types/api"

/**
 * POST /api/v1/bookings/[id]/set-time-slot
 * Set time slot for a pre-order booking (warehouse worker action)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { id: bookingId } = await params
    const body = await request.json()
    const { scheduledDatetime } = body

    if (!scheduledDatetime) {
      const errorData: ErrorResponse = {
        success: false,
        error: "scheduledDatetime is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Validate datetime format
    const datetime = new Date(scheduledDatetime)
    if (isNaN(datetime.getTime())) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invalid datetime format. Use ISO 8601 format (e.g., 2025-01-15T09:00:00Z)",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Verify booking exists
    const booking = await getBookingById(bookingId, false)
    if (!booking) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Booking not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Set time slot
    const updatedBooking = await setBookingTimeSlot(bookingId, scheduledDatetime, user.id)

    const responseData = {
      success: true,
      data: updatedBooking,
      message: "Time slot set successfully",
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: "Failed to set time slot" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

