import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getBookingById } from "@/lib/db/bookings"
import { confirmBooking } from "@/lib/business-logic/bookings"
import { generateBookingInvoice } from "@/lib/business-logic/invoices"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { calculateMembershipTierFromSpend } from "@/lib/business-logic/membership"
import { getInvoices } from "@/lib/db/invoices"
import { calculateWarehouseAvailability } from "@/lib/business-logic/capacity-management"
import type { ErrorResponse } from "@/types/api"

/**
 * POST /api/v1/bookings/[id]/approve
 * Approve a pending booking, reserve capacity, and generate invoice
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

    // Check if user is admin or root
    const supabase = await createServerSupabaseClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .eq('status', true) // Soft delete filter
      .single()

    if (profileError || !profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Profile not found',
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Only company_admin or root can approve bookings
    if (profile.role !== 'company_admin' && profile.role !== 'root') {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Unauthorized. Only admins can approve bookings.',
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const { id: bookingId } = await params

    // Get booking to verify it exists and is pending
    const booking = await getBookingById(bookingId, false) // Don't use cache
    if (!booking) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Booking not found',
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check if booking is pending
    // Note: status field in Booking type is the business status (booking_status in DB)
    // The soft delete status field is separate in the database
    if (booking.status !== 'pending') {
      const errorData: ErrorResponse = {
        success: false,
        error: `Booking is not pending. Current status: ${booking.status}`,
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Re-check capacity availability before approving
    // This ensures capacity is still available at the time of approval
    const bookingType = booking.type === 'pallet' ? 'pallet' : 'area-rental'
    const fromDate = booking.startDate
    const toDate = booking.endDate || booking.startDate // Use startDate as fallback if endDate is null

    try {
      const availability = await calculateWarehouseAvailability(
        booking.warehouseId,
        fromDate,
        toDate,
        bookingType
      )

      // Check if required capacity is available
      const requiredCapacity = booking.type === 'pallet' 
        ? (booking.palletCount || 0)
        : (booking.areaSqFt || 0)

      if (availability.available < requiredCapacity) {
        const errorData: ErrorResponse = {
          success: false,
          error: `Insufficient capacity. Required: ${requiredCapacity}, Available: ${availability.available}`,
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
    } catch (capacityError) {
      // Log the error but proceed with approval attempt
      // confirmBooking will handle capacity reservation and throw if insufficient
      console.error('Capacity check error (proceeding anyway):', capacityError)
    }

    // Confirm booking (reserves capacity and updates status to confirmed)
    const confirmedBooking = await confirmBooking(bookingId)

    // Get customer's total spend to calculate membership tier
    const invoices = await getInvoices({
      customerId: booking.customerId,
      status: 'paid', // invoice_status = 'paid'
      useCache: false,
    })
    const totalSpend = invoices.reduce((sum, invoice) => sum + invoice.total, 0)
    const membershipTier = await calculateMembershipTierFromSpend(totalSpend)

    // Generate invoice for the booking
    const invoiceResult = await generateBookingInvoice({
      bookingId: bookingId,
      customerId: booking.customerId,
      customerName: booking.customerName,
      invoiceType: 'booking',
      membershipTier,
    })

    const responseData = {
      success: true,
      data: {
        booking: confirmedBooking,
        invoice: invoiceResult.invoice,
      },
      message: 'Booking approved and invoice created successfully',
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: 'Failed to approve booking' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

