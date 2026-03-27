/**
 * Idempotency Key Management for Stripe Operations
 *
 * Ensures exactly-once payment processing even with network retries.
 * Keys are deterministic: same inputs always produce the same key, making
 * them safe to reuse on retry without creating a second Stripe PaymentIntent.
 * Critical for financial consistency.
 */

import crypto from "crypto";

/**
 * Generate a deterministic idempotency key for Stripe operations.
 *
 * The key is derived solely from stable inputs (operation, bookingId, metadata)
 * without any timestamp, so retrying the same operation produces the same key.
 * Stripe will return the original PaymentIntent rather than creating a duplicate.
 *
 * Format: {operation}-{bookingId}-{sha256(operation+bookingId+metadata)[0:16]}
 *
 * @param operation - Operation type: deposit, checkout, refund
 * @param bookingId - Booking ID
 * @param metadata - Additional context for hash uniqueness (must be stable across retries)
 * @returns Idempotency key (max 255 chars for Stripe)
 */
export function generateIdempotencyKey(
  operation: "deposit" | "checkout" | "refund",
  bookingId: string,
  metadata?: Record<string, any>
): string {
  // Serialize metadata with sorted keys so key order doesn't change the hash
  const metaStr = metadata ? JSON.stringify(metadata, Object.keys(metadata).sort()) : "";

  const hash = crypto
    .createHash("sha256")
    .update(`${operation}-${bookingId}-${metaStr}`)
    .digest("hex")
    .substring(0, 16);

  // Format: operation-bookingId-hash
  const key = `${operation}-${bookingId}-${hash}`;

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
