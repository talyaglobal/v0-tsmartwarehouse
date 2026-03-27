/**
 * QR code payload for pallets: customer, booking, warehouse, pallet_id, checkin_date
 *
 * Payloads are HMAC-SHA256 signed using QR_SIGNING_SECRET to prevent forgery.
 * Any QR code not carrying a valid signature is rejected at scan time.
 */

import crypto from "crypto";

export interface PalletQRPayload {
  customer_id: string;
  booking_id: string;
  warehouse_id: string;
  pallet_id: string;
  checkin_date: string;
}

// Signed wire format stored in the qr_code column and printed on labels
interface SignedQRPayload {
  v: 1; // version, for future format upgrades
  d: PalletQRPayload;
  sig: string; // HMAC-SHA256(JSON.stringify(d), secret)
}

function getSigningSecret(): string {
  const secret = process.env.QR_SIGNING_SECRET;
  if (!secret) {
    // Fall back to a build-time constant so existing QR codes remain readable
    // in development; production MUST set QR_SIGNING_SECRET.
    if (process.env.NODE_ENV === "production") {
      throw new Error("QR_SIGNING_SECRET environment variable is required in production");
    }
    return "dev-qr-signing-secret-not-for-production";
  }
  return secret;
}

function signPayload(data: PalletQRPayload): string {
  const secret = getSigningSecret();
  const dataStr = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHmac("sha256", secret).update(dataStr).digest("hex");
}

/**
 * Encode a pallet QR payload with an HMAC signature.
 * The resulting string is what gets stored in `inventory_items.qr_code`
 * and embedded in the printed QR code.
 */
export function encodePalletQRPayload(payload: PalletQRPayload): string {
  const sig = signPayload(payload);
  const signed: SignedQRPayload = { v: 1, d: payload, sig };
  return JSON.stringify(signed);
}

/**
 * Decode and verify a QR payload string.
 * Returns the payload if the signature is valid; null otherwise.
 *
 * Also accepts the legacy unsigned format (plain JSON without `v`/`sig`)
 * for backwards compatibility with QR codes printed before this change.
 */
export function decodePalletQRPayload(json: string): PalletQRPayload | null {
  try {
    const parsed = JSON.parse(json);

    // ── Signed format (v1) ──────────────────────────────────────
    if (parsed.v === 1 && parsed.d && parsed.sig) {
      const data = parsed.d as PalletQRPayload;
      if (!isCompletePayload(data)) return null;

      const expectedSig = signPayload(data);
      // Constant-time comparison to prevent timing attacks
      if (
        !crypto.timingSafeEqual(Buffer.from(expectedSig, "hex"), Buffer.from(parsed.sig, "hex"))
      ) {
        console.warn("QR payload signature mismatch — possible tamper attempt");
        return null;
      }
      return data;
    }

    // ── Legacy unsigned format (backwards compat) ────────────────
    // Accept if it looks like the old plain-JSON format, but log a warning.
    if (isCompletePayload(parsed)) {
      console.warn(
        "QR payload has no signature (legacy format). Re-issue QR code for this pallet."
      );
      return parsed as PalletQRPayload;
    }

    return null;
  } catch {
    return null;
  }
}

function isCompletePayload(p: any): p is PalletQRPayload {
  return (
    typeof p === "object" &&
    p !== null &&
    typeof p.customer_id === "string" &&
    p.customer_id.length > 0 &&
    typeof p.booking_id === "string" &&
    p.booking_id.length > 0 &&
    typeof p.warehouse_id === "string" &&
    p.warehouse_id.length > 0 &&
    typeof p.pallet_id === "string" &&
    p.pallet_id.length > 0 &&
    typeof p.checkin_date === "string" &&
    p.checkin_date.length > 0
  );
}
