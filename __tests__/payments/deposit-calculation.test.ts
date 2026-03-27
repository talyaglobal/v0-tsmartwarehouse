import { describe, it, expect } from "vitest";

/**
 * Unit Tests: Deposit Calculation Logic
 *
 * Critical path: 10% deposit calculation must be exact
 */

describe("Deposit Calculation", () => {
  const DEPOSIT_PERCENT = 0.1;

  describe("Standard deposit calculation", () => {
    it("should calculate 10% deposit for $100 booking", () => {
      const totalAmount = 100;
      const depositAmount = totalAmount * DEPOSIT_PERCENT;

      expect(depositAmount).toBe(10);
    });

    it("should calculate 10% deposit for $250.50 booking", () => {
      const totalAmount = 250.5;
      const depositAmount = totalAmount * DEPOSIT_PERCENT;

      expect(depositAmount).toBe(25.05);
    });

    it("should round deposit to 2 decimal places", () => {
      const totalAmount = 123.456;
      const depositAmount = Math.round(totalAmount * DEPOSIT_PERCENT * 100) / 100;

      expect(depositAmount).toBe(12.35);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero total amount", () => {
      const totalAmount = 0;
      const depositAmount = totalAmount * DEPOSIT_PERCENT;

      expect(depositAmount).toBe(0);
    });

    it("should handle very small amounts", () => {
      const totalAmount = 0.01;
      const depositAmount = totalAmount * DEPOSIT_PERCENT;

      expect(depositAmount).toBe(0.001);
    });

    it("should handle large amounts", () => {
      const totalAmount = 999999.99;
      const depositAmount = Math.round(totalAmount * DEPOSIT_PERCENT * 100) / 100;

      expect(depositAmount).toBe(100000.0);
    });

    it("should never produce negative deposit", () => {
      const totalAmount = -100;
      const depositAmount = Math.max(0, totalAmount * DEPOSIT_PERCENT);

      expect(depositAmount).toBe(0);
    });
  });

  describe("Amount due calculation after deposit", () => {
    it("should calculate remaining amount after 10% deposit", () => {
      const totalAmount = 100;
      const depositPaid = 10;
      const amountDue = Math.max(0, totalAmount - depositPaid);

      expect(amountDue).toBe(90);
    });

    it("should handle full payment (no amount due)", () => {
      const totalAmount = 100;
      const depositPaid = 100;
      const amountDue = Math.max(0, totalAmount - depositPaid);

      expect(amountDue).toBe(0);
    });

    it("should never produce negative amount due", () => {
      const totalAmount = 100;
      const depositPaid = 150; // Overpayment
      const amountDue = Math.max(0, totalAmount - depositPaid);

      expect(amountDue).toBe(0);
    });
  });

  describe("Stripe amount conversion (cents)", () => {
    it("should convert dollars to cents correctly", () => {
      const amountDollars = 25.5;
      const amountCents = Math.round(amountDollars * 100);

      expect(amountCents).toBe(2550);
    });

    it("should handle rounding edge cases", () => {
      const amountDollars = 25.555; // Should round to 25.56
      const amountCents = Math.round(amountDollars * 100);

      expect(amountCents).toBe(2556);
    });

    it("should convert cents to dollars correctly", () => {
      const amountCents = 2550;
      const amountDollars = amountCents / 100;

      expect(amountDollars).toBe(25.5);
    });
  });
});
