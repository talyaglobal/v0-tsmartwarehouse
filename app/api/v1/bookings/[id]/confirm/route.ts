import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse, ApiResponse } from "@/types/api"

/**
 * POST /api/v1/bookings/[id]/confirm
 * Confirm a booking after successful payment (for local development without webhook)
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const bookingId = params.id

    const supabase = await createServerSupabaseClient()

    // Get the booking first
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single()

    if (fetchError || !booking) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Booking not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check if already confirmed
    if (booking.booking_status === "confirmed" || booking.booking_status === "active") {
      const responseData: ApiResponse = {
        success: true,
        data: booking,
        message: "Booking is already confirmed",
      }
      return NextResponse.json(responseData)
    }

    // Update booking status to confirmed
    const { data: updatedBooking, error: updateError } = await supabase
      .from("bookings")
      .update({
        booking_status: "confirmed",
        payment_status: "completed",
        amount_paid: booking.total_amount,
        amount_due: 0,
        paid_at: new Date().toISOString(),
      })
      .eq("id", bookingId)
      .select()
      .single()

    if (updateError) {
      console.error("Failed to update booking:", updateError)
      const errorData: ErrorResponse = {
        success: false,
        error: `Failed to confirm booking: ${updateError.message}`,
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    // Note: Warehouse capacity will be automatically updated by the database trigger
    console.log("Booking confirmed:", bookingId)

    const responseData: ApiResponse = {
      success: true,
      data: updatedBooking,
      message: "Booking confirmed successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Booking confirmation error:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to confirm booking",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}
