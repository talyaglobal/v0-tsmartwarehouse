import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { generateBookingInvoice } from "@/lib/business-logic/invoices"
import { getBookingById } from "@/lib/db/bookings"
import { getInvoices } from "@/lib/db/invoices"
import { getMembershipSettingByTier } from "@/lib/db/membership"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"
import type { Invoice } from "@/types"

/**
 * POST /api/v1/invoices/generate-from-booking
 * Generate an invoice for a booking if it doesn't exist
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // Only customers can generate invoices for their own bookings
    if (user.role !== "customer") {
      const errorData: ErrorResponse = {
        success: false,
        error: "Only customers can generate invoices for their bookings",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const body = await request.json()
    const { bookingId } = body

    if (!bookingId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "bookingId is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Get booking and verify it belongs to the user
    const booking = await getBookingById(bookingId, false)
    if (!booking) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Booking not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    if (booking.customerId !== user.id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "You don't have permission to generate invoice for this booking",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Check if invoice already exists
    const existingInvoices = await getInvoices({ bookingId, useCache: false })
    if (existingInvoices.length > 0) {
      // Return existing invoice
      return NextResponse.json({
        success: true,
        data: existingInvoices[0],
        message: "Invoice already exists",
      })
    }

    // Get user's membership tier (if any)
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('membership_tier')
      .eq('id', user.id)
      .maybeSingle()

    const membershipTier = profile?.membership_tier || undefined

    // Generate invoice
    const invoiceResult = await generateBookingInvoice({
      bookingId,
      customerId: user.id,
      customerName: booking.customerName,
      invoiceType: "booking",
      membershipTier,
    })

    return NextResponse.json({
      success: true,
      data: invoiceResult.invoice,
      message: invoiceResult.message,
    })
  } catch (error) {
    console.error("Error generating invoice from booking:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate invoice",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

