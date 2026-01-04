import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { checkWarehouseAvailability } from "@/lib/business-logic/availability"
import { getBookingById, updateBooking } from "@/lib/db/bookings"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const selectTimeSlotSchema = z.object({
  selectedDate: z.string(), // YYYY-MM-DD format
  selectedTime: z.string(), // HH:mm format
})

/**
 * POST /api/v1/bookings/[id]/select-time-slot
 * Customer selects a time slot from available options
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

    // Get booking
    const booking = await getBookingById(bookingId)
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
        error: "You can only select time slots for your own bookings",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Verify booking is in awaiting_time_slot status
    if (booking.status !== "awaiting_time_slot") {
      const errorData: ErrorResponse = {
        success: false,
        error: "Booking must be in awaiting_time_slot status to select a time slot",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const body = await request.json()

    // Validate request body
    let validatedData
    try {
      validatedData = selectTimeSlotSchema.parse(body)
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

    const { selectedDate, selectedTime } = validatedData

    // Check availability
    const availability = await checkWarehouseAvailability(
      booking.warehouseId,
      selectedDate,
      selectedTime
    )

    if (!availability.available) {
      const errorData: ErrorResponse = {
        success: false,
        error: availability.reason || "Selected time slot is not available",
        statusCode: 400,
        code: "SLOT_NOT_AVAILABLE",
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Combine date and time into datetime
    const scheduledDatetime = `${selectedDate}T${selectedTime}:00`

    // Update booking with selected time slot
    // Clear proposed date/time fields if they exist (customer selected different time)
    const updatedBooking = await updateBooking(bookingId, {
      scheduledDropoffDatetime: scheduledDatetime,
      timeSlotConfirmedAt: new Date().toISOString(),
      status: "payment_pending", // Always move to payment_pending after time slot selection
      // Clear proposed fields if customer selected different time
      proposedStartDate: undefined,
      proposedStartTime: undefined,
      dateChangeRequestedAt: undefined,
      dateChangeRequestedBy: undefined,
    })

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: "Time slot selected successfully",
      redirectUrl: `/payment?bookingId=${bookingId}`, // Redirect to payment page
    })
  } catch (error) {
    console.error("Error selecting time slot:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to select time slot",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

