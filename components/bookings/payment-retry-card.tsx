"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CreditCard, RefreshCw } from "lucide-react";
import type { Booking } from "@/types";

interface PaymentRetryCardProps {
  booking: Booking;
  onRetrySuccess?: () => void;
}

/**
 * Payment Retry Card Component
 *
 * Displays payment failure information and allows customer to retry payment
 * Used when deposit payment fails or times out
 */
export function PaymentRetryCard({ booking, onRetrySuccess }: PaymentRetryCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show for payment_pending status
  if (booking.status !== "payment_pending") {
    return null;
  }

  // Check if payment failed or timed out
  const hasPaymentFailed = false; // TODO: Add payment_failed_at field to track failures
  const isExpiringSoon = (() => {
    if (!booking.createdAt) return false;
    const createdAt = new Date(booking.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation > 23; // Expires at 24h
  })();

  const handleRetryPayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call create-deposit-intent again to get new PaymentIntent
      const response = await fetch(`/api/v1/bookings/${booking.id}/create-deposit-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create payment intent");
      }

      // Redirect to payment page with new client secret
      window.location.href = `/payment?bookingId=${booking.id}&clientSecret=${data.clientSecret}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment retry failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-900">
          <AlertCircle className="h-5 w-5" />
          Payment Required
        </CardTitle>
        <CardDescription className="text-orange-700">
          {hasPaymentFailed
            ? "Your payment attempt failed. Please try again."
            : "Complete your 10% deposit payment to confirm this booking."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isExpiringSoon && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This booking will expire soon. Please complete payment within 1 hour to secure your
              reservation.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Deposit Amount (10%)</span>
            <span className="font-semibold text-gray-900">
              ${booking.depositAmount?.toFixed(2) || (booking.totalAmount * 0.1).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Booking Amount</span>
            <span className="text-gray-900">${booking.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Remaining (paid at checkout)</span>
            <span className="text-gray-900">
              ${(booking.totalAmount * 0.9 - (booking.depositAmount || 0)).toFixed(2)}
            </span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button onClick={handleRetryPayment} disabled={isLoading} className="w-full" size="lg">
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              {hasPaymentFailed ? "Retry Payment" : "Pay Deposit Now"}
            </>
          )}
        </Button>

        <p className="text-xs text-center text-gray-500">Secure payment powered by Stripe</p>
      </CardContent>
    </Card>
  );
}
