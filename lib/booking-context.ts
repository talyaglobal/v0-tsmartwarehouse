/**
 * Booking-on-behalf context stored in sessionStorage when user chooses
 * "Book for another client" on /dashboard/bookings/new. Consumed by
 * warehouse book flow to call on-behalf API instead of self booking.
 */

export const BOOKING_ON_BEHALF_KEY = "booking_on_behalf_context"

export interface BookingOnBehalfContext {
  customerId: string
  customerName: string | null
  customerEmail: string | null
  requiresApproval: boolean
  requestMessage?: string
}

export function getBookingOnBehalfContext(): BookingOnBehalfContext | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(BOOKING_ON_BEHALF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BookingOnBehalfContext
    if (!parsed?.customerId) return null
    return parsed
  } catch {
    return null
  }
}

export function setBookingOnBehalfContext(ctx: BookingOnBehalfContext): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(BOOKING_ON_BEHALF_KEY, JSON.stringify(ctx))
  } catch {
    // ignore
  }
}

export function clearBookingOnBehalfContext(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(BOOKING_ON_BEHALF_KEY)
  } catch {
    // ignore
  }
}
