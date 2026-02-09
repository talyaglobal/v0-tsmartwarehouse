import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ""

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const supabase = await createServerSupabaseClient()
  const paymentType = paymentIntent.metadata?.payment_type
  const isDeposit = paymentType === "deposit"
  const isCheckoutRemaining = paymentType === "checkout_remaining"
  const bookingIdFromMeta = paymentIntent.metadata?.booking_id
  const checkoutRequestId = paymentIntent.metadata?.checkout_request_id as string | undefined

  let booking: { id: string; total_amount?: number; deposit_amount?: number } | null = null

  if (isDeposit && bookingIdFromMeta) {
    const { data: b } = await supabase
      .from("bookings")
      .select("id, total_amount, deposit_amount")
      .eq("id", bookingIdFromMeta)
      .maybeSingle()
    booking = b
  }

  if (!booking) {
    const { data: bookingByIntent } = await supabase
      .from("bookings")
      .select("*")
      .eq("payment_intent_id", paymentIntent.id)
      .maybeSingle()
    if (bookingByIntent) {
      booking = bookingByIntent
    }
  }

  if (!booking) {
    const { data: payment } = await supabase
      .from("payments")
      .select("invoice_id")
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .maybeSingle()

    if (payment?.invoice_id) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("booking_id")
        .eq("id", payment.invoice_id)
        .maybeSingle()

      if (invoice?.booking_id) {
        const { data: bookingByInvoice } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", invoice.booking_id)
          .maybeSingle()
        if (bookingByInvoice) {
          booking = bookingByInvoice
        }
      }
    }
  }

  if (!booking) {
    console.error("Booking not found for payment intent:", paymentIntent.id)
    return
  }

  if (isCheckoutRemaining && checkoutRequestId) {
    try {
      const { markCheckoutRequestPaid } = await import("@/lib/db/checkout-requests")
      await markCheckoutRequestPaid(checkoutRequestId)
    } catch (e) {
      console.error("Failed to mark checkout request paid:", e)
    }
    return
  }

  const amountPaidCents = paymentIntent.amount
  const amountPaidDollars = amountPaidCents / 100
  const totalAmount = Number(booking.total_amount) || 0
  const amountDue = isDeposit ? Math.max(0, totalAmount - amountPaidDollars) : 0

  const updatePayload: Record<string, unknown> = isDeposit
    ? {
        deposit_paid_at: new Date().toISOString(),
        booking_status: "confirmed",
        payment_status: "completed",
        amount_paid: amountPaidDollars,
        amount_due: amountDue,
        paid_at: new Date().toISOString(),
      }
    : {
        booking_status: "confirmed",
        payment_status: "completed",
        amount_paid: amountPaidDollars,
        amount_due: 0,
        paid_at: new Date().toISOString(),
      }

  const { error: updateError } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", booking.id)

  if (updateError) {
    console.error("Failed to update booking:", updateError)
    return
  }
}

async function handlePaymentIntentPaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const supabase = await createServerSupabaseClient()

  // Find booking by payment_intent_id
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("*")
    .eq("payment_intent_id", paymentIntent.id)
    .single()

  if (fetchError || !booking) {
    console.error("Booking not found for payment intent:", paymentIntent.id)
    return
  }

  // Update booking status to failed
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      payment_status: "failed",
      payment_notes: paymentIntent.last_payment_error?.message || "Payment failed",
    })
    .eq("id", booking.id)

  if (updateError) {
    console.error("Failed to update booking:", updateError)
  }

  // TODO: Send failure notification email to customer

}

/**
 * POST /api/v1/payments/webhook
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")

    if (!signature) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Missing signature",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (error) {
      console.error("Webhook signature verification failed:", error)
      const errorData: ErrorResponse = {
        success: false,
        error: "Webhook signature verification failed",
        statusCode: 401,
      }
      return NextResponse.json(errorData, { status: 401 })
    }

    // Handle different event types
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
        break
      case "payment_intent.payment_failed":
        await handlePaymentIntentPaymentFailed(event.data.object as Stripe.PaymentIntent)
        break
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook processing error:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Webhook processing failed",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}
