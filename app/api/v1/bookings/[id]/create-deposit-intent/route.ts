import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { getBookingById } from "@/lib/db/bookings"
import { getOrCreateStripeCustomer, createDepositPaymentIntent } from "@/lib/payments/stripe"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"

const DEPOSIT_PERCENT = 0.1

/**
 * POST /api/v1/bookings/[id]/create-deposit-intent
 * Create Stripe PaymentIntent for 10% deposit only. Used when customer accepts proposed time (payment_pending).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { id: bookingId } = await params
    const booking = await getBookingById(bookingId, false)

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found", statusCode: 404 } satisfies ErrorResponse,
        { status: 404 }
      )
    }

    if (booking.customerId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden", statusCode: 403 } satisfies ErrorResponse,
        { status: 403 }
      )
    }

    if (booking.status !== "payment_pending") {
      return NextResponse.json(
        { success: false, error: "Booking must be in payment_pending status to pay deposit", statusCode: 400 } satisfies ErrorResponse,
        { status: 400 }
      )
    }

    if (booking.depositPaidAt) {
      return NextResponse.json(
        { success: false, error: "Deposit already paid", statusCode: 400 } satisfies ErrorResponse,
        { status: 400 }
      )
    }

    const totalAmount = booking.totalAmount ?? 0
    const depositAmount = totalAmount * DEPOSIT_PERCENT

    if (depositAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid booking amount for deposit", statusCode: 400 } satisfies ErrorResponse,
        { status: 400 }
      )
    }

    const stripeCustomer = await getOrCreateStripeCustomer({
      email: booking.customerEmail,
      name: booking.customerName || "Customer",
      metadata: { customer_id: booking.customerId },
    })

    const paymentIntent = await createDepositPaymentIntent({
      amount: depositAmount,
      customerId: stripeCustomer.id,
      bookingId: booking.id,
      customerEmail: booking.customerEmail,
    })

    const supabase = await import("@/lib/supabase/server").then((m) => m.createServerSupabaseClient())
    await supabase
      .from("bookings")
      .update({
        deposit_amount: depositAmount,
        payment_intent_id: paymentIntent.id,
      })
      .eq("id", bookingId)

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: depositAmount,
      depositPercent: DEPOSIT_PERCENT * 100,
    })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/bookings/[id]/create-deposit-intent" })
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    )
  }
}
