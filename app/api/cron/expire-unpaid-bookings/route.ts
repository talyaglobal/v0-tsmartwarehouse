import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ErrorResponse } from "@/types/api";

/**
 * GET /api/cron/expire-unpaid-bookings
 *
 * Cron job to automatically expire bookings in payment_pending status
 * that are older than 24 hours. Releases warehouse capacity.
 *
 * Schedule: Run every hour
 * Vercel Cron: 0 * * * * (every hour at minute 0)
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Find bookings in payment_pending status older than 24 hours
    const expirationThreshold = new Date();
    expirationThreshold.setHours(expirationThreshold.getHours() - 24);

    const { data: expiredBookings, error: fetchError } = await supabase
      .from("bookings")
      .select(
        "id, customer_id, customer_name, customer_email, warehouse_id, start_date, total_amount, deposit_amount"
      )
      .eq("booking_status", "payment_pending")
      .lt("created_at", expirationThreshold.toISOString())
      .eq("status", true); // Only active bookings

    if (fetchError) {
      console.error("Failed to fetch expired bookings:", fetchError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch expired bookings: ${fetchError.message}`,
          statusCode: 500,
        } satisfies ErrorResponse,
        { status: 500 }
      );
    }

    if (!expiredBookings || expiredBookings.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No expired bookings found",
        expired: 0,
      });
    }

    const results: {
      bookingId: string;
      success: boolean;
      error?: string;
    }[] = [];

    // Process each expired booking
    for (const booking of expiredBookings) {
      try {
        const now = new Date().toISOString();

        // Update booking status to cancelled
        const { error: updateError } = await supabase
          .from("bookings")
          .update({
            booking_status: "cancelled",
            cancelled_at: now,
            cancellation_reason: "Payment not received within 24 hours (auto-expired)",
            cancel_type: "admin",
            refund_amount: 0,
            refund_percent: 0,
            updated_at: now,
          })
          .eq("id", booking.id);

        if (updateError) {
          results.push({
            bookingId: booking.id,
            success: false,
            error: updateError.message,
          });
          continue;
        }

        // TODO: Send expiration email to customer
        // await sendExpirationEmail({
        //   to: booking.customer_email,
        //   name: booking.customer_name,
        //   bookingId: booking.id,
        //   startDate: booking.start_date
        // })

        // TODO: Release warehouse capacity
        // This would involve updating warehouse availability
        // if capacity tracking is implemented

        results.push({
          bookingId: booking.id,
          success: true,
        });
      } catch (error) {
        results.push({
          bookingId: booking.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Expired ${successCount} bookings (${failureCount} failed)`,
      expired: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Cron job failed",
        statusCode: 500,
      } satisfies ErrorResponse,
      { status: 500 }
    );
  }
}
