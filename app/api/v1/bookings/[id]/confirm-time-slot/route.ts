import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getBookingById } from "@/lib/db/bookings"
import { confirmBookingTimeSlot } from "@/lib/business-logic/bookings"
import type { ErrorResponse } from "@/types/api"

/**
 * POST /api/v1/bookings/[id]/confirm-time-slot
 * Confirm time slot for a pre-order booking (customer action)
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

    // Confirm time slot
    const updatedBooking = await confirmBookingTimeSlot(bookingId, user.id)

    const responseData = {
      success: true,
      data: updatedBooking,
      message: "Time slot confirmed successfully. You can now proceed with payment.",
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: "Failed to confirm time slot" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

