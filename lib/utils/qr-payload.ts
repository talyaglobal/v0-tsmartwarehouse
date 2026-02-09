/**
 * QR code payload for pallets: customer, booking, warehouse, pallet_id, checkin_date
 */

export interface PalletQRPayload {
  customer_id: string
  booking_id: string
  warehouse_id: string
  pallet_id: string
  checkin_date: string
}

export function encodePalletQRPayload(payload: PalletQRPayload): string {
  return JSON.stringify(payload)
}

export function decodePalletQRPayload(json: string): PalletQRPayload | null {
  try {
    const parsed = JSON.parse(json) as PalletQRPayload
    if (
      parsed.customer_id &&
      parsed.booking_id &&
      parsed.warehouse_id &&
      parsed.pallet_id &&
      parsed.checkin_date
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}
