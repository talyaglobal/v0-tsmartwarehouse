import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { setBookingAwaitingTimeSlot } from "@/lib/business-logic/warehouse-staff"
import { getNotificationService } from "@/lib/notifications/service"
import { getBookingById } from "@/lib/db/bookings"
import type { ErrorResponse } from "@/types/api"

/**
 * POST /api/v1/bookings/[id]/set-awaiting-time-slot
 * Set booking status to awaiting_time_slot (warehouse staff confirms requested date/time is available)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult

    // Verify user is warehouse staff
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'warehouse_staff') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Only warehouse staff can perform this action",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const bookingId = params.id

    // Set booking to awaiting_time_slot
    const updatedBooking = await setBookingAwaitingTimeSlot(bookingId, user.id)

    // Send notification to customer
    try {
      const notificationService = getNotificationService()
      await notificationService.sendNotification({
        userId: updatedBooking.customerId,
        type: "booking",
        channels: ["push", "email"],
        title: "Time Slot Selection Required",
        message: `Your booking ${updatedBooking.id} is ready. Please select a time slot.`,
        metadata: {
          bookingId: updatedBooking.id,
          bookingType: updatedBooking.type,
          notificationSubType: "awaiting_time_slot",
        },
      })
    } catch (notificationError) {
      console.error("Failed to send notification:", notificationError)
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: "Booking status updated to awaiting_time_slot",
    })
  } catch (error) {
    console.error("Error setting booking awaiting time slot:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update booking status",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

