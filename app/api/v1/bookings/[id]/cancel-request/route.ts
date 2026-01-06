import { type NextRequest, NextResponse } from "next/server"
import { getBookingById } from "@/lib/db/bookings"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, BookingResponse } from "@/types/api"
import { getCurrentUser } from "@/lib/auth/utils"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getNotificationService } from "@/lib/notifications/service"

/**
 * POST /api/v1/bookings/[id]/cancel-request
 * Create a cancel request for a paid booking
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params
    const body = await request.json()
    const { reason } = body

    // Get current user
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

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

    // Only customer can request cancellation
    if (currentUser.role !== 'customer' || booking.customerId !== currentUser.id) {
      return NextResponse.json(
        { success: false, error: "Only the booking customer can request cancellation" },
        { status: 403 }
      )
    }

    // Check if booking is paid (has invoice with status paid)
    const supabase = createServerSupabaseClient()
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('booking_id', bookingId)
      .eq('status', 'paid')
      .maybeSingle()

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Only paid bookings can have cancel requests" },
        { status: 400 }
      )
    }

    // Check if already has cancel request
    if (booking.status === 'cancel_request') {
      return NextResponse.json(
        { success: false, error: "Cancel request already exists for this booking" },
        { status: 400 }
      )
    }

    // Update booking to cancel_request status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        booking_status: 'cancel_request',
        cancel_requested_at: new Date().toISOString(),
        cancel_requested_by: currentUser.id,
        cancel_reason: reason || null,
      })
      .eq('id', bookingId)
    
    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Failed to update booking: ${updateError.message}` },
        { status: 500 }
      )
    }
    
    const updatedBooking = await getBookingById(bookingId)

    // Get warehouse owner and admin users to notify
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('owner_company_id, name')
      .eq('id', booking.warehouseId)
      .single()

    if (warehouse) {
      const { data: companyUsers } = await supabase
        .from('profiles')
        .select('id, email, name')
        .eq('company_id', warehouse.owner_company_id)
        .in('role', ['warehouse_owner', 'warehouse_admin'])

      // Send notifications to warehouse owner and admin
      const notificationService = getNotificationService()
      if (companyUsers) {
        for (const user of companyUsers) {
          await notificationService.sendNotification({
            userId: user.id,
            type: 'booking',
            title: 'Cancel Request Received',
            message: `Customer ${booking.customerName} has requested to cancel booking ${booking.id} for warehouse ${warehouse.name}`,
            channels: ['email', 'push'],
            metadata: {
              bookingId: booking.id,
              customerId: booking.customerId,
              customerName: booking.customerName,
              warehouseId: booking.warehouseId,
              warehouseName: warehouse.name,
              reason: reason || 'No reason provided',
            },
          })
        }
      }
    }

    const responseData: BookingResponse = {
      success: true,
      data: updatedBooking || undefined,
      message: "Cancel request submitted successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: `/api/v1/bookings/${(await params).id}/cancel-request` })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

