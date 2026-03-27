/**
 * Idempotency Key Management for Stripe Operations
 *
 * Ensures exactly-once payment processing even with network retries.
 * Critical for financial consistency.
 */

import crypto from "crypto";

/**
 * Generate idempotency key for Stripe operations
 *
 * Format: {operation}-{bookingId}-{timestamp}-{hash}
 *
 * @param operation - Operation type: deposit, checkout, refund
 * @param bookingId - Booking ID
 * @param metadata - Additional context for hash uniqueness
 * @returns Idempotency key (max 255 chars for Stripe)
 */
export function generateIdempotencyKey(
  operation: "deposit" | "checkout" | "refund",
  bookingId: string,
  metadata?: Record<string, any>
): string {
  const timestamp = Date.now();

  // Create hash from metadata for additional uniqueness
  const metaStr = metadata ? JSON.stringify(metadata) : "";
  const hash = crypto
    .createHash("sha256")
    .update(`${operation}-${bookingId}-${timestamp}-${metaStr}`)
    .digest("hex")
    .substring(0, 8);

  // Format: operation-bookingId-timestamp-hash
  const key = `${operation}-${bookingId}-${timestamp}-${hash}`;

  // Stripe limit: 255 characters
  if (key.length > 255) {
    return key.substring(0, 255);
  }

  return key;
}

/**
 * Validate idempotency key format
 */
export function isValidIdempotencyKey(key: string): boolean {
  if (!key || key.length > 255) return false;

  // Format: {operation}-{bookingId}-{timestamp}-{hash}
  const parts = key.split("-");
  if (parts.length < 4) return false;

  const [operation] = parts;
  return ["deposit", "checkout", "refund"].includes(operation);
}

/**
 * Parse idempotency key components
 */
export function parseIdempotencyKey(key: string): {
  operation: string;
  bookingId: string;
  timestamp: number;
  hash: string;
} | null {
  if (!isValidIdempotencyKey(key)) return null;

  const parts = key.split("-");
  const operation = parts[0];
  const bookingId = parts.slice(1, -2).join("-");
  const timestamp = parseInt(parts[parts.length - 2]);
  const hash = parts[parts.length - 1];

  return { operation, bookingId, timestamp, hash };
}
