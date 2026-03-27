/**
 * Unit Tests: Refund Calculation Logic
 *
 * Critical path: Time-based refund policy must be enforced correctly
 */

import { describe, it, expect } from "@jest/globals";

// Refund calculation function (extracted for testing)
function calculateRefund(
  depositAmount: number,
  hoursUntilStart: number,
  bookingStatus: string
): { refundAmount: number; refundPercent: number; reason: string } {
  // No refund after check-in
  if (["active", "completed"].includes(bookingStatus)) {
    return { refundAmount: 0, refundPercent: 0, reason: "Booking already active or completed" };
  }

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

describe("Refund Calculation", () => {
  describe("Time-based refund policy", () => {
    const depositAmount = 25.0;

    it("should refund 100% when cancelled >48h before start", () => {
      const result = calculateRefund(depositAmount, 72, "payment_pending");

      expect(result.refundAmount).toBe(25.0);
      expect(result.refundPercent).toBe(100);
      expect(result.reason).toContain("more than 48 hours");
    });

    it("should refund 100% at exactly 48.1 hours", () => {
      const result = calculateRefund(depositAmount, 48.1, "confirmed");

      expect(result.refundAmount).toBe(25.0);
      expect(result.refundPercent).toBe(100);
    });

    it("should refund 50% when cancelled between 24-48h", () => {
      const result = calculateRefund(depositAmount, 36, "confirmed");

      expect(result.refundAmount).toBe(12.5);
      expect(result.refundPercent).toBe(50);
      expect(result.reason).toContain("24-48 hours");
    });

    it("should refund 50% at exactly 24.1 hours", () => {
      const result = calculateRefund(depositAmount, 24.1, "confirmed");

      expect(result.refundAmount).toBe(12.5);
      expect(result.refundPercent).toBe(50);
    });

    it("should refund 0% when cancelled <24h before start", () => {
      const result = calculateRefund(depositAmount, 12, "confirmed");

      expect(result.refundAmount).toBe(0);
      expect(result.refundPercent).toBe(0);
      expect(result.reason).toContain("less than 24 hours");
    });

    it("should refund 0% at exactly 23.9 hours", () => {
      const result = calculateRefund(depositAmount, 23.9, "confirmed");

      expect(result.refundAmount).toBe(0);
      expect(result.refundPercent).toBe(0);
    });

    it("should refund 0% when cancelled 1 hour before", () => {
      const result = calculateRefund(depositAmount, 1, "confirmed");

      expect(result.refundAmount).toBe(0);
    });

    it("should refund 0% when cancelled after start time (negative hours)", () => {
      const result = calculateRefund(depositAmount, -5, "confirmed");

      expect(result.refundAmount).toBe(0);
    });
  });

  describe("Status-based refund restrictions", () => {
    const depositAmount = 25.0;

    it("should refund 0% when booking is active (pallets checked in)", () => {
      const result = calculateRefund(depositAmount, 100, "active");

      expect(result.refundAmount).toBe(0);
      expect(result.reason).toContain("already active");
    });

    it("should refund 0% when booking is completed", () => {
      const result = calculateRefund(depositAmount, 100, "completed");

      expect(result.refundAmount).toBe(0);
      expect(result.reason).toContain("completed");
    });

    it("should allow refund for confirmed booking >48h before", () => {
      const result = calculateRefund(depositAmount, 72, "confirmed");

      expect(result.refundAmount).toBe(25.0);
    });

    it("should allow refund for payment_pending booking >48h before", () => {
      const result = calculateRefund(depositAmount, 72, "payment_pending");

      expect(result.refundAmount).toBe(25.0);
    });
  });

  describe("Boundary conditions", () => {
    it("should handle exactly 48 hours (edge case)", () => {
      const result = calculateRefund(25.0, 48.0, "confirmed");

      // At exactly 48h, should give 50% (not 100%)
      expect(result.refundPercent).toBe(50);
    });

    it("should handle exactly 24 hours (edge case)", () => {
      const result = calculateRefund(25.0, 24.0, "confirmed");

      // At exactly 24h, should give 0% (not 50%)
      expect(result.refundPercent).toBe(0);
    });

    it("should handle fractional deposit amounts", () => {
      const result = calculateRefund(12.345, 72, "confirmed");

      expect(result.refundAmount).toBe(12.345);
    });

    it("should handle zero deposit amount", () => {
      const result = calculateRefund(0, 72, "confirmed");

      expect(result.refundAmount).toBe(0);
    });
  });
});
