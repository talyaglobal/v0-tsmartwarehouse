import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { getBookingById } from "@/lib/db/bookings"
import {
  createCheckoutRequest,
  getCheckoutRequestsByBookingId,
} from "@/lib/db/checkout-requests"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getOrCreateStripeCustomer } from "@/lib/payments/stripe"
import Stripe from "stripe"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const stripe =
  process.env.STRIPE_SECRET_KEY ?
    new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null

const createBodySchema = z.object({
  pallet_ids: z.array(z.string().uuid()).optional(),
  pallet_count: z.number().int().min(1).optional(),
}).refine((d) => (d.pallet_ids?.length ?? 0) > 0 || (d.pallet_count ?? 0) >= 1, {
  message: "Provide pallet_ids or pallet_count",
})

/**
 * GET /api/v1/bookings/[id]/checkout-requests
 * List checkout requests for a booking
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult
    const { id: bookingId } = await params

    const booking = await getBookingById(bookingId, false)
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found", statusCode: 404 } satisfies ErrorResponse,
        { status: 404 }
      )
    }

    if (booking.customerId !== user.id) {
      const supabase = createServerSupabaseClient()
      const { data: staff } = await supabase
        .from("warehouse_staff")
        .select("user_id")
        .eq("warehouse_id", booking.warehouseId)
        .eq("user_id", user.id)
        .eq("status", true)
        .maybeSingle()
      if (!staff) {
        return NextResponse.json(
          { success: false, error: "Forbidden", statusCode: 403 } satisfies ErrorResponse,
          { status: 403 }
        )
      }
    }

    const list = await getCheckoutRequestsByBookingId(bookingId)
    return NextResponse.json({ success: true, data: list })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/bookings/[id]/checkout-requests" })
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    )
  }
}

/**
 * POST /api/v1/bookings/[id]/checkout-requests
 * Create a checkout request (remaining payment for N pallets). Returns clientSecret for Stripe.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult
    const { id: bookingId } = await params

    const booking = await getBookingById(bookingId, false)
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found", statusCode: 404 } satisfies ErrorResponse,
        { status: 404 }
      )
    }

    if (booking.customerId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden", statusCode: 403 } satisfies ErrorResponse,
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const parsed = createBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid body", statusCode: 400, details: parsed.error.flatten() } satisfies ErrorResponse,
        { status: 400 }
      )
    }

    const totalAmount = booking.totalAmount ?? 0
    const depositPaid = booking.depositPaidAt ? (booking.depositAmount ?? totalAmount * 0.1) : 0
    const remainingTotal = Math.max(0, totalAmount - depositPaid)

    const totalPalletCount = booking.palletCount ?? 1
    const supabase = createServerSupabaseClient()

    let palletIds: string[]
    if (parsed.data.pallet_ids?.length) {
      palletIds = parsed.data.pallet_ids
    } else {
      const { data: items } = await supabase
        .from("inventory_items")
        .select("id")
        .eq("booking_id", bookingId)
        .not("inventory_item_status", "eq", "shipped")
        .limit(parsed.data.pallet_count ?? 999)
      const list = (items ?? []) as { id: string }[]
      palletIds = list.map((i) => i.id)
      if ((parsed.data.pallet_count ?? 0) > 0 && palletIds.length > parsed.data.pallet_count!) {
        palletIds = palletIds.slice(0, parsed.data.pallet_count)
      }
    }

    if (palletIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No pallets found to check out", statusCode: 400 } satisfies ErrorResponse,
        { status: 400 }
      )
    }

    const N = palletIds.length
    const { data: itemsWithReceived } = await supabase
      .from("inventory_items")
      .select("id, received_at")
      .in("id", palletIds)

    const receivedAts = (itemsWithReceived ?? []).map((r: any) => r.received_at).filter(Boolean)
    const startDate = booking.startDate ? new Date(booking.startDate).getTime() : Date.now()
    const endDate = booking.endDate ? new Date(booking.endDate).getTime() : startDate + 30 * 24 * 60 * 60 * 1000
    const totalBookingDays = Math.max(1, (endDate - startDate) / (24 * 60 * 60 * 1000))
    const now = Date.now()
    let daysStored = totalBookingDays
    if (receivedAts.length > 0) {
      const sumDays = receivedAts.reduce((sum: number, r: string) => {
        const received = new Date(r).getTime()
        return sum + (now - received) / (24 * 60 * 60 * 1000)
      }, 0)
      daysStored = sumDays / receivedAts.length
    } else {
      daysStored = (now - startDate) / (24 * 60 * 60 * 1000)
    }
    daysStored = Math.max(0, Math.min(daysStored, totalBookingDays))

    const amount =
      remainingTotal * (N / totalPalletCount) * (daysStored / totalBookingDays)
    const roundedAmount = Math.round(amount * 100) / 100

    const checkoutRequest = await createCheckoutRequest({
      bookingId,
      warehouseId: booking.warehouseId,
      customerId: booking.customerId,
      palletCount: N,
      amount: roundedAmount,
      createdBy: user.id,
      metadata: { pallet_ids: palletIds },
    })

    if (!stripe || roundedAmount <= 0) {
      return NextResponse.json({
        success: true,
        data: checkoutRequest,
        clientSecret: null,
        message: roundedAmount <= 0 ? "No payment required" : "Stripe not configured",
      })
    }

    const customer = await getOrCreateStripeCustomer({
      email: booking.customerEmail,
      name: booking.customerName || "Customer",
      metadata: { customer_id: booking.customerId },
    })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(roundedAmount * 100),
      currency: "usd",
      customer: customer.id,
      metadata: {
        booking_id: bookingId,
        checkout_request_id: checkoutRequest.id,
        payment_type: "checkout_remaining",
      },
      automatic_payment_methods: { enabled: true },
    })

    return NextResponse.json({
      success: true,
      data: { ...checkoutRequest, stripePaymentIntentId: paymentIntent.id },
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/bookings/[id]/checkout-requests" })
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    )
  }
}
