import { type NextRequest, NextResponse } from "next/server"
import { getBookingById, updateBooking } from "@/lib/db/bookings"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, BookingResponse } from "@/types/api"
import { getCurrentUser } from "@/lib/auth/utils"
import { isCompanyAdmin } from "@/lib/auth/company-admin"
import { cancelBooking } from "@/lib/business-logic/bookings"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getNotificationService } from "@/lib/notifications/service"

/**
 * POST /api/v1/bookings/[id]/process-cancel-request
 * Approve or reject a cancel request (warehouse owner/admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params
    const body = await request.json()
    const { action } = body // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Action must be 'approve' or 'reject'" },
        { status: 400 }
      )
    }

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

    // Check if booking has cancel request
    if (booking.status !== 'cancel_request') {
      return NextResponse.json(
        { success: false, error: "Booking does not have a cancel request" },
        { status: 400 }
      )
    }

    // Get warehouse company ID
    const supabase = createServerSupabaseClient()
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('owner_company_id, name')
      .eq('id', booking.warehouseId)
      .single()

    if (!warehouse) {
      return NextResponse.json(
        { success: false, error: "Warehouse not found" },
        { status: 404 }
      )
    }

    // Check if user is warehouse owner or admin
    const userCompanyId = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', currentUser.id)
      .single()

    if (!userCompanyId.data || userCompanyId.data.company_id !== warehouse.owner_company_id) {
      return NextResponse.json(
        { success: false, error: "Only warehouse owner or admin can process cancel requests" },
        { status: 403 }
      )
    }

    const isAdmin = await isCompanyAdmin(currentUser.id, warehouse.owner_company_id)
    if (!isAdmin && currentUser.role !== 'warehouse_admin') {
      return NextResponse.json(
        { success: false, error: "Only warehouse owner or admin can process cancel requests" },
        { status: 403 }
      )
    }

    let updatedBooking

    if (action === 'approve') {
      // Cancel the booking
      updatedBooking = await cancelBooking(bookingId)
      
      // Update booking status (cancelProcessedAt and cancelProcessedBy are not in Booking type)
      updatedBooking = await updateBooking(bookingId, {
        status: "cancelled",
      })

      // Notify customer
      const notificationService = getNotificationService()
      await notificationService.sendNotification({
        userId: booking.customerId,
        type: 'booking',
        title: 'Cancel Request Approved',
        message: `Your cancel request for booking ${booking.id} has been approved.`,
        channels: ['email', 'push'],
        metadata: {
          bookingId: booking.id,
          warehouseId: booking.warehouseId,
          warehouseName: warehouse.name,
        },
      })
    } else {
      // Reject the cancel request - revert to previous status
      // We need to determine what the previous status was
      // For paid bookings, it should be 'confirmed' or 'active'
      const previousStatus = booking.status === 'cancel_request' ? 'confirmed' : booking.status
      
      updatedBooking = await updateBooking(bookingId, {
        status: previousStatus,
      })
      
      // Update cancel processed fields
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          cancel_processed_at: new Date().toISOString(),
          cancel_processed_by: currentUser.id,
        })
        .eq('id', bookingId)
      
      if (updateError) {
        console.error('Error updating cancel processed fields:', updateError)
      }
      
      updatedBooking = await getBookingById(bookingId)

      // Notify customer
      const notificationService = getNotificationService()
      await notificationService.sendNotification({
        userId: booking.customerId,
        type: 'booking',
        title: 'Cancel Request Rejected',
        message: `Your cancel request for booking ${booking.id} has been rejected. Please contact support for more information.`,
        channels: ['email', 'push'],
        metadata: {
          bookingId: booking.id,
          warehouseId: booking.warehouseId,
          warehouseName: warehouse.name,
        },
      })
    }

    const responseData: BookingResponse = {
      success: true,
      data: updatedBooking || undefined,
      message: `Cancel request ${action}d successfully`,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: `/api/v1/bookings/${(await params).id}/process-cancel-request` })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

