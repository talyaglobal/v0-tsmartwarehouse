import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-middleware";
import { getBookingById } from "@/lib/db/bookings";
import { createRefund, getPaymentIntent } from "@/lib/payments/stripe";
import { generateIdempotencyKey } from "@/lib/payments/idempotency";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/utils/logger";
import type { ErrorResponse } from "@/types/api";
import type { Booking } from "@/types";
import { z } from "zod";

const cancelBodySchema = z.object({
  reason: z.string().min(1).max(500).optional(),
  cancel_type: z.enum(["customer", "warehouse", "admin"]).default("customer"),
});

/**
 * Calculate refund amount based on cancellation policy
 *
 * Policy:
 * - Cancel >48h before start: 100% refund
 * - Cancel 24-48h before start: 50% refund
 * - Cancel <24h before start: No refund
 * - After check-in: No refund
 */
function calculateRefundAmount(booking: Booking): {
  refundAmount: number;
  refundPercent: number;
  reason: string;
} {
  // No refund if deposit not paid
  if (!booking.depositPaidAt || !booking.depositAmount) {
    return { refundAmount: 0, refundPercent: 0, reason: "No deposit paid" };
  }

  // No refund after check-in
  if (["active", "completed"].includes(booking.status)) {
    return { refundAmount: 0, refundPercent: 0, reason: "Booking already active or completed" };
  }

  const depositAmount = booking.depositAmount;
  const startDate = new Date(booking.startDate);
  const now = new Date();
  const hoursUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Cancel >48h before: 100% refund
  if (hoursUntilStart > 48) {
    return {
      refundAmount: depositAmount,
      refundPercent: 100,
      reason: "Cancelled more than 48 hours before start date",
    };
  }

  // Cancel 24-48h before: 50% refund
  if (hoursUntilStart > 24) {
    return {
      refundAmount: depositAmount * 0.5,
      refundPercent: 50,
      reason: "Cancelled 24-48 hours before start date",
    };
  }

  // Cancel <24h before: No refund
  return {
    refundAmount: 0,
    refundPercent: 0,
    reason: "Cancelled less than 24 hours before start date",
  };
}

/**
 * POST /api/v1/bookings/[id]/cancel
 * Cancel booking with refund calculation based on policy
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const { id: bookingId } = await params;
    const booking = await getBookingById(bookingId, false);

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found", statusCode: 404 } satisfies ErrorResponse,
        { status: 404 }
      );
    }

    // Auth check: customer, warehouse staff, or admin
    const supabase = createServerSupabaseClient();
    const isCustomer = booking.customerId === user.id;

    // Check if user is warehouse staff
    const { data: staff } = await supabase
      .from("warehouse_staff")
      .select("user_id")
      .eq("warehouse_id", booking.warehouseId)
      .eq("user_id", user.id)
      .eq("status", true)
      .maybeSingle();

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "root";
    const isWarehouseStaff = !!staff;

    if (!isCustomer && !isWarehouseStaff && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden", statusCode: 403 } satisfies ErrorResponse,
        { status: 403 }
      );
    }

    // Validate booking status - can't cancel if already cancelled or completed
    if (["cancelled", "completed"].includes(booking.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot cancel booking with status: ${booking.status}`,
          statusCode: 400,
        } satisfies ErrorResponse,
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const parsed = cancelBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid body",
          statusCode: 400,
          details: JSON.stringify(parsed.error.flatten()),
        } satisfies ErrorResponse,
        { status: 400 }
      );
    }

    const { reason, cancel_type } = parsed.data;

    // Calculate refund based on policy
    const refundCalc = calculateRefundAmount(booking);

    // Process Stripe refund if applicable
    let stripeRefundId: string | null = null;
    let refundError: string | null = null;

    if (refundCalc.refundAmount > 0) {
      try {
        // Need to get payment intent first to find charge ID
        const supabaseAdmin = createServerSupabaseClient();
        const { data: bookingRow } = await supabaseAdmin
          .from("bookings")
          .select("payment_intent_id")
          .eq("id", bookingId)
          .single();

        if (bookingRow?.payment_intent_id) {
          const paymentIntent = await getPaymentIntent(bookingRow.payment_intent_id);

          // PaymentIntent may have charges array (v2023-10-16 API)
          const charges = (paymentIntent as any).charges?.data || [];

          if (charges.length > 0) {
            const chargeId = charges[0].id;

            // Generate idempotency key for exactly-once refund processing
            const idempotencyKey = generateIdempotencyKey("refund", bookingId, {
              chargeId,
              amount: refundCalc.refundAmount,
              reason: cancel_type,
            });

            const refund = await createRefund({
              chargeId,
              amount: refundCalc.refundAmount,
              reason: "requested_by_customer",
              idempotencyKey,
              metadata: {
                booking_id: bookingId,
                cancel_type,
                refund_reason: refundCalc.reason,
              },
            });

            stripeRefundId = refund.id;
          } else {
            refundError = "No charge found for payment intent";
          }
        } else {
          refundError = "No payment intent ID found";
        }
      } catch (error) {
        console.error("Stripe refund failed:", error);
        refundError = error instanceof Error ? error.message : "Refund failed";
        // Continue with cancellation even if refund fails
        // Admin can manually process refund later
      }
    }

    // Update booking status
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        booking_status: "cancelled",
        cancelled_at: now,
        cancellation_reason: reason || refundCalc.reason,
        cancelled_by: user.id,
        cancel_type,
        refund_amount: refundCalc.refundAmount,
        refund_percent: refundCalc.refundPercent,
        stripe_refund_id: stripeRefundId,
        refund_error: refundError,
        updated_at: now,
      })
      .eq("id", bookingId);

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to cancel booking: ${updateError.message}`,
          statusCode: 500,
        } satisfies ErrorResponse,
        { status: 500 }
      );
    }

    // TODO: Send cancellation confirmation email
    // TODO: Release warehouse capacity
    // TODO: Notify warehouse staff

    return NextResponse.json({
      success: true,
      data: {
        bookingId,
        status: "cancelled",
        refundAmount: refundCalc.refundAmount,
        refundPercent: refundCalc.refundPercent,
        refundReason: refundCalc.reason,
        stripeRefundId,
        refundError,
        cancelledAt: now,
      },
    });
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/bookings/[id]/cancel" });
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    );
  }
}
