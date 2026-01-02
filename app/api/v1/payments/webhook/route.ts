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

  // First try to find booking by payment_intent_id
  let booking = null
  const { data: bookingByIntent, error: fetchError } = await supabase
    .from("bookings")
    .select("*")
    .eq("payment_intent_id", paymentIntent.id)
    .maybeSingle()

  if (!fetchError && bookingByIntent) {
    booking = bookingByIntent
  } else {
    // If not found by payment_intent_id, try to find via invoice
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

  // Update booking status to confirmed
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      booking_status: "confirmed",
      payment_status: "completed",
      amount_paid: paymentIntent.amount / 100,
      amount_due: 0,
      paid_at: new Date().toISOString(),
    })
    .eq("id", booking.id)

  if (updateError) {
    console.error("Failed to update booking:", updateError)
    return
  }

  // TODO: Send confirmation email to customer
  console.log("Booking confirmed:", booking.id)
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
  console.log("Payment failed for booking:", booking.id)
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
