import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { getBookingById, updateBooking } from "@/lib/db/bookings"
import type { ErrorResponse } from "@/types/api"

/**
 * POST /api/v1/bookings/[id]/accept-proposed-time
 * Customer accepts the proposed date/time from warehouse staff
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult

    // Resolve params (Next.js 15+ compatibility)
    const resolvedParams = await Promise.resolve(params)
    const bookingId = resolvedParams.id

    console.log(`[accept-proposed-time API] Received request for bookingId: ${bookingId}, userId: ${user.id}`)

    // Get booking
    const booking = await getBookingById(bookingId, false) // Disable cache
    if (!booking) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Booking not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Verify customer owns this booking
    if (booking.customerId !== user.id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "You can only accept proposed time for your own bookings",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Verify booking is in awaiting_time_slot status
    if (booking.status !== "awaiting_time_slot") {
      const errorData: ErrorResponse = {
        success: false,
        error: "Booking must be in awaiting_time_slot status to accept proposed time",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Verify proposed date/time exists
    if (!booking.proposedStartDate || !booking.proposedStartTime) {
      const errorData: ErrorResponse = {
        success: false,
        error: "No proposed date/time found for this booking",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Combine proposed date and time into datetime
    const proposedDate = new Date(booking.proposedStartDate).toISOString().split("T")[0]
    const scheduledDatetime = `${proposedDate}T${booking.proposedStartTime}:00`

    // Update booking: accept proposed time, clear proposal fields, move to payment_pending
    const updatedBooking = await updateBooking(bookingId, {
      scheduledDropoffDatetime: scheduledDatetime,
      timeSlotConfirmedAt: new Date().toISOString(),
      status: "payment_pending",
      // Clear proposed fields
      proposedStartDate: undefined,
      proposedStartTime: undefined,
      dateChangeRequestedAt: undefined,
      dateChangeRequestedBy: undefined,
    })

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: "Proposed time slot accepted successfully",
      redirectUrl: `/payment?bookingId=${bookingId}`, // Redirect to payment page
    })
  } catch (error) {
    console.error("Error accepting proposed time:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to accept proposed time",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

