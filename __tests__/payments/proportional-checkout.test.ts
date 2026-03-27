/**
 * Unit Tests: Proportional Checkout Amount Calculation
 *
 * Critical path: Formula must be accurate for financial integrity
 * Formula: remaining × (N_pallets / total_pallets) × (days_stored / total_days)
 */

import { describe, it, expect } from "@jest/globals";

function calculateProportionalCheckout(
  totalAmount: number,
  depositPaid: number,
  totalPallets: number,
  checkoutPallets: number,
  totalDays: number,
  daysStored: number
): number {
  const remaining = Math.max(0, totalAmount - depositPaid);
  const palletRatio = checkoutPallets / totalPallets;
  const dayRatio = daysStored / totalDays;
  const amount = remaining * palletRatio * dayRatio;

  return Math.round(amount * 100) / 100; // Round to 2 decimals
}

describe("Proportional Checkout Amount", () => {
  describe("Complete checkout (all pallets, full duration)", () => {
    it("should charge 90% when checking out all pallets for full duration", () => {
      const amount = calculateProportionalCheckout(
        100, // total
        10, // deposit (10%)
        10, // total pallets
        10, // checking out all
        30, // total days
        30 // stored full duration
      );

      expect(amount).toBe(90); // 90% remaining
    });
  });

  describe("Partial pallet checkout", () => {
    it("should charge 45% when checking out half the pallets for full duration", () => {
      const amount = calculateProportionalCheckout(
        100, // total
        10, // deposit
        10, // total pallets
        5, // checking out half
        30, // total days
        30 // stored full duration
      );

      expect(amount).toBe(45); // 50% of remaining 90%
    });

    it("should charge proportionally for 3 out of 10 pallets", () => {
      const amount = calculateProportionalCheckout(
        100,
        10,
        10,
        3, // 30% of pallets
        30,
        30
      );

      expect(amount).toBe(27); // 30% of remaining 90%
    });

    it("should charge for single pallet out of 10", () => {
      const amount = calculateProportionalCheckout(
        100,
        10,
        10,
        1, // 10% of pallets
        30,
        30
      );

      expect(amount).toBe(9); // 10% of remaining 90%
    });
  });

  describe("Early checkout (partial duration)", () => {
    it("should charge half price for half storage duration", () => {
      const amount = calculateProportionalCheckout(
        100,
        10,
        10,
        10, // all pallets
        30, // booked for 30 days
        15 // stored only 15 days
      );

      expect(amount).toBe(45); // 50% of 90%
    });

    it("should charge 1/3 price for 1/3 storage duration", () => {
      const amount = calculateProportionalCheckout(
        100,
        10,
        10,
        10,
        30,
        10 // stored only 10 days
      );

      expect(amount).toBe(30); // 33.33% of 90%
    });
  });

  describe("Combined partial (pallets + duration)", () => {
    it("should charge correctly for half pallets + half duration", () => {
      const amount = calculateProportionalCheckout(
        100,
        10,
        10,
        5, // 50% pallets
        30,
        15 // 50% duration
      );

      expect(amount).toBe(22.5); // 50% × 50% of 90% = 22.5%
    });

    it("should handle complex scenario: 3 pallets, 10 days of 30", () => {
      const amount = calculateProportionalCheckout(
        250, // total
        25, // deposit (10%)
        10, // total pallets
        3, // 30% pallets
        30, // total days
        10 // 33% duration
      );

      // Remaining: 225 (90%)
      // 30% pallets × 33% duration = 10% of remaining
      // 225 × 0.30 × 0.333 = 22.5
      expect(amount).toBe(22.5);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero remaining amount (full payment already made)", () => {
      const amount = calculateProportionalCheckout(
        100,
        100, // full payment as deposit
        10,
        10,
        30,
        30
      );

      expect(amount).toBe(0);
    });

    it("should handle zero storage days (immediate checkout)", () => {
      const amount = calculateProportionalCheckout(
        100,
        10,
        10,
        10,
        30,
        0 // immediate checkout
      );

      expect(amount).toBe(0);
    });

    it("should handle storage exceeding booking duration (cap at 100%)", () => {
      const amount = calculateProportionalCheckout(
        100,
        10,
        10,
        10,
        30,
        45 // stored 45 days of 30 booked
      );

      // Should cap at 100% of total days
      const cappedDays = Math.min(45, 30);
      const expected = 90 * (cappedDays / 30);
      expect(amount).toBe(expected);
    });

    it("should prevent negative amounts", () => {
      const amount = calculateProportionalCheckout(
        100,
        150, // overpaid
        10,
        10,
        30,
        30
      );

      expect(amount).toBe(0);
    });

    it("should round to 2 decimal places", () => {
      const amount = calculateProportionalCheckout(123.456, 12.346, 7, 3, 25, 17);

      // Should be rounded to 2 decimals
      expect(amount).toMatch(/^\d+\.\d{0,2}$/);
    });
  });

  describe("Real-world scenarios", () => {
    it("should calculate correctly for typical warehouse booking", () => {
      // Scenario: 20 pallets, $500 total, 60 days booking
      // Customer checks out 8 pallets after 40 days
      const amount = calculateProportionalCheckout(
        500, // $500 total
        50, // $50 deposit (10%)
        20, // 20 total pallets
        8, // checking out 8
        60, // 60 day booking
        40 // stored 40 days
      );

      // Remaining: $450
      // 8/20 pallets = 40%
      // 40/60 days = 66.67%
      // 450 × 0.40 × 0.6667 = $120
      expect(amount).toBe(120);
    });

    it("should handle early full checkout", () => {
      // Scenario: 5 pallets, $150 total, 30 days booking
      // Customer checks out all 5 after 10 days
      const amount = calculateProportionalCheckout(
        150,
        15, // 10% deposit
        5,
        5, // all pallets
        30,
        10 // only 10 days stored
      );

      // Remaining: $135
      // All pallets: 100%
      // 10/30 days = 33.33%
      // 135 × 1.0 × 0.3333 = $45
      expect(amount).toBe(45);
    });
  });
});
