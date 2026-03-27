import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ErrorResponse } from "@/types/api";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const supabase = await createServerSupabaseClient();
  const paymentType = paymentIntent.metadata?.payment_type;
  const isDeposit = paymentType === "deposit";
  const isCheckoutRemaining = paymentType === "checkout_remaining";
  const bookingIdFromMeta = paymentIntent.metadata?.booking_id;
  const checkoutRequestId = paymentIntent.metadata?.checkout_request_id as string | undefined;

  let booking: { id: string; total_amount?: number; deposit_amount?: number } | null = null;

  if (isDeposit && bookingIdFromMeta) {
    const { data: b } = await supabase
      .from("bookings")
      .select("id, total_amount, deposit_amount")
      .eq("id", bookingIdFromMeta)
      .maybeSingle();
    booking = b;

    // Log deposit success event
    if (b) {
      const { error: logError } = await supabase.rpc("log_payment_event", {
        p_booking_id: b.id,
        p_event_type: "deposit_succeeded",
        p_amount: paymentIntent.amount / 100,
        p_stripe_payment_intent_id: paymentIntent.id,
        p_stripe_event_id: null,
        p_status: "completed",
        p_metadata: { payment_type: "deposit" },
      });
      if (logError) console.error("Failed to log payment event:", logError);
    }
  }

  if (!booking) {
    const { data: bookingByIntent } = await supabase
      .from("bookings")
      .select("*")
      .eq("payment_intent_id", paymentIntent.id)
      .maybeSingle();
    if (bookingByIntent) {
      booking = bookingByIntent;
    }
  }

  if (!booking) {
    const { data: payment } = await supabase
      .from("payments")
      .select("invoice_id")
      .eq("stripe_payment_intent_id", paymentIntent.id)
      .maybeSingle();

    if (payment?.invoice_id) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("booking_id")
        .eq("id", payment.invoice_id)
        .maybeSingle();

      if (invoice?.booking_id) {
        const { data: bookingByInvoice } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", invoice.booking_id)
          .maybeSingle();
        if (bookingByInvoice) {
          booking = bookingByInvoice;
        }
      }
    }
  }

  if (!booking) {
    console.error("Booking not found for payment intent:", paymentIntent.id);
    return;
  }

  if (isCheckoutRemaining && checkoutRequestId) {
    try {
      const { markCheckoutRequestPaid } = await import("@/lib/db/checkout-requests");
      await markCheckoutRequestPaid(checkoutRequestId);

      // Log checkout payment success event
      const { error: logError } = await supabase.rpc("log_payment_event", {
        p_booking_id: booking.id,
        p_event_type: "checkout_succeeded",
        p_amount: paymentIntent.amount / 100,
        p_checkout_request_id: checkoutRequestId,
        p_stripe_payment_intent_id: paymentIntent.id,
        p_status: "completed",
        p_metadata: { payment_type: "checkout_remaining" },
      });
      if (logError) console.error("Failed to log payment event:", logError);
    } catch (e) {
      console.error("Failed to mark checkout request paid:", e);
    }
    return;
  }

  const amountPaidCents = paymentIntent.amount;
  const amountPaidDollars = amountPaidCents / 100;
  const totalAmount = Number(booking.total_amount) || 0;
  const amountDue = isDeposit ? Math.max(0, totalAmount - amountPaidDollars) : 0;

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
      };

  const { error: updateError } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", booking.id);

  if (updateError) {
    console.error("Failed to update booking:", updateError);
    return;
  }

  // Send payment success email (deposit confirmed → booking confirmed)
  if (isDeposit && booking) {
    try {
      const { getNotificationService } = await import("@/lib/notifications/service");
      const notificationService = getNotificationService();
      const totalAmount = Number(booking.total_amount) || 0;
      const depositPaid = amountPaidDollars;
      await notificationService.sendNotification({
        userId: (booking as any).customer_id ?? bookingIdFromMeta ?? "",
        type: "booking",
        channels: ["email"],
        title: "Deposit Payment Confirmed",
        message: `Your deposit of $${depositPaid.toFixed(2)} has been received. Booking #${booking.id} is now confirmed.`,
        template: "payment-deposit-success",
        templateData: {
          bookingId: booking.id,
          depositAmount: depositPaid.toFixed(2),
          remainingAmount: Math.max(0, totalAmount - depositPaid).toFixed(2),
        },
      });
    } catch (notifErr) {
      // Non-fatal: log but don't fail the webhook
      console.error("Failed to send deposit success notification:", notifErr);
    }
  }
}

async function handlePaymentIntentPaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const supabase = await createServerSupabaseClient();

  // Find booking by payment_intent_id
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("*")
    .eq("payment_intent_id", paymentIntent.id)
    .single();

  if (fetchError || !booking) {
    console.error("Booking not found for payment intent:", paymentIntent.id);
    return;
  }

  // Log payment failure event
  const { error: logError } = await supabase.rpc("log_payment_event", {
    p_booking_id: booking.id,
    p_event_type:
      paymentIntent.metadata?.payment_type === "deposit" ? "deposit_failed" : "checkout_failed",
    p_amount: paymentIntent.amount / 100,
    p_stripe_payment_intent_id: paymentIntent.id,
    p_status: "failed",
    p_error_message: paymentIntent.last_payment_error?.message || "Payment failed",
    p_metadata: { payment_type: paymentIntent.metadata?.payment_type || "unknown" },
  });
  if (logError) console.error("Failed to log payment event:", logError);

  // Update booking status to failed
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      payment_status: "failed",
      payment_failed_at: new Date().toISOString(),
      payment_notes: paymentIntent.last_payment_error?.message || "Payment failed",
    })
    .eq("id", booking.id);

  if (updateError) {
    console.error("Failed to update booking:", updateError);
  }

  // Send payment failure email
  try {
    const { getNotificationService } = await import("@/lib/notifications/service");
    const notificationService = getNotificationService();
    const errorMsg = paymentIntent.last_payment_error?.message || "Payment failed";
    await notificationService.sendNotification({
      userId: booking.customer_id,
      type: "booking",
      channels: ["email"],
      title: "Deposit Payment Failed",
      message: `Your deposit payment for booking #${booking.id} could not be processed. Please retry.`,
      template: "payment-deposit-failed",
      templateData: {
        bookingId: booking.id,
        depositAmount: (paymentIntent.amount / 100).toFixed(2),
        errorMessage: errorMsg,
      },
    });
  } catch (notifErr) {
    console.error("Failed to send payment failure notification:", notifErr);
  }
}

/**
 * POST /api/v1/payments/webhook
 * Handle Stripe webhook events with deduplication and audit logging
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Missing signature",
        statusCode: 400,
      };
      return NextResponse.json(errorData, { status: 400 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      const errorData: ErrorResponse = {
        success: false,
        error: "Webhook signature verification failed",
        statusCode: 401,
      };
      return NextResponse.json(errorData, { status: 401 });
    }

    // Atomic deduplication: INSERT ... ON CONFLICT DO NOTHING.
    // This replaces the non-atomic check-then-insert pattern that had a
    // TOCTOU race window under concurrent re-deliveries of the same event.
    // If the row already exists (UNIQUE constraint on stripe_event_id), the
    // insert is a no-op and `count` will be 0, signalling a duplicate.
    const supabase = await createServerSupabaseClient();
    const { count, error: insertError } = await supabase
      .from("stripe_webhook_events")
      .upsert(
        {
          stripe_event_id: event.id,
          event_type: event.type,
          payload: event as any,
          processing_result: "processing",
        },
        { onConflict: "stripe_event_id", ignoreDuplicates: true, count: "exact" }
      )
      .execute();

    if (insertError) {
      // A DB error here is unexpected — log it but do not proceed to avoid
      // processing an event whose deduplication state is unknown.
      console.error("Webhook deduplication insert error:", insertError);
      return NextResponse.json(
        { success: false, error: "Deduplication check failed", statusCode: 500 },
        { status: 500 }
      );
    }

    if (count === 0) {
      // Row already existed — this is a duplicate delivery.
      console.log("Duplicate webhook event ignored:", event.id);
      return NextResponse.json({
        success: true,
        message: "Event already processed",
      });
    }

    let processingResult = "success";
    let errorMessage: string | null = null;

    // Handle different event types
    try {
      switch (event.type) {
        case "payment_intent.succeeded":
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case "payment_intent.payment_failed":
          await handlePaymentIntentPaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
      }
    } catch (handlerError) {
      processingResult = "error";
      errorMessage = handlerError instanceof Error ? handlerError.message : "Handler failed";
      console.error("Event handler error:", handlerError);
    }

    // Update processing result
    await supabase
      .from("stripe_webhook_events")
      .update({
        processing_result: processingResult,
        ...(errorMessage && { error_message: errorMessage }),
      })
      .eq("stripe_event_id", event.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Webhook processing failed",
      statusCode: 500,
    };
    return NextResponse.json(errorData, { status: 500 });
  }
}
