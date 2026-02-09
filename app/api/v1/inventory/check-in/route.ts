import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { getBookingById } from "@/lib/db/bookings"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { encodePalletQRPayload } from "@/lib/utils/qr-payload"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const bodySchema = z.object({
  booking_id: z.string(),
  warehouse_id: z.string().uuid(),
  pallet_count: z.number().int().min(1).max(500),
  photos: z.object({
    sealed: z.string().min(1),
    opened_emptying: z.string().min(1),
    empty: z.string().min(1),
  }),
})

/**
 * POST /api/v1/inventory/check-in
 * Pallet check-in: create inventory items with required 3 photos, set qr_code, log operation.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult

    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid body", statusCode: 400, details: parsed.error.flatten() } satisfies ErrorResponse,
        { status: 400 }
      )
    }

    const { booking_id, warehouse_id, pallet_count, photos } = parsed.data
    const booking = await getBookingById(booking_id, false)
    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found", statusCode: 404 } satisfies ErrorResponse,
        { status: 404 }
      )
    }
    if (booking.warehouseId !== warehouse_id || booking.customerId === undefined) {
      return NextResponse.json(
        { success: false, error: "Booking mismatch", statusCode: 400 } satisfies ErrorResponse,
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()
    const { data: staff } = await supabase
      .from("warehouse_staff")
      .select("user_id")
      .eq("warehouse_id", warehouse_id)
      .eq("user_id", user.id)
      .eq("status", true)
      .maybeSingle()
    const { data: wh } = await supabase
      .from("warehouses")
      .select("owner_company_id")
      .eq("id", warehouse_id)
      .single()
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()
    const isCompanyAdmin = wh?.owner_company_id && profile?.company_id === wh.owner_company_id
    if (!staff && !isCompanyAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden", statusCode: 403 } satisfies ErrorResponse,
        { status: 403 }
      )
    }

    const now = new Date().toISOString()
    const customerId = booking.customerId
    const created: { id: string; pallet_id: string; qr_code: string }[] = []

    for (let i = 0; i < pallet_count; i++) {
      const palletId = `${booking_id}-P${i + 1}-${Date.now()}`
      const qrPayload = encodePalletQRPayload({
        customer_id: customerId,
        booking_id,
        warehouse_id,
        pallet_id: palletId,
        checkin_date: now,
      })

      const insertRow: Record<string, unknown> = {
        booking_id,
        customer_id: customerId,
        warehouse_id,
        pallet_id: palletId,
        qr_code: qrPayload,
        received_at: now,
      }
      const { data: item, error: itemError } = await supabase
        .from("inventory_items")
        .insert({
          ...insertRow,
          inventory_item_status: "received",
        })
        .select("id, pallet_id, qr_code")
        .single()

      if (itemError) {
        const alt = await supabase
          .from("inventory_items")
          .insert({
            ...insertRow,
            status: "received",
          })
          .select("id, pallet_id, qr_code")
          .single()
        if (alt.error) {
          throw new Error(`Failed to create inventory item: ${itemError.message}`)
        }
        created.push(alt.data as { id: string; pallet_id: string; qr_code: string })
      } else {
        created.push(item as { id: string; pallet_id: string; qr_code: string })
      }

      const itemId = created[created.length - 1].id

      for (const [photoType, storagePath] of Object.entries(photos)) {
        await supabase.from("pallet_checkin_photos").insert({
          inventory_item_id: itemId,
          photo_type: photoType,
          storage_path: storagePath,
          uploaded_by: user.id,
        })
      }

      await supabase.from("pallet_operation_logs").insert({
        inventory_item_id: itemId,
        booking_id,
        warehouse_id,
        operation: "check_in",
        performed_by: user.id,
        performed_at: now,
        metadata: { pallet_count: pallet_count, index: i + 1 },
      })
    }

    return NextResponse.json({
      success: true,
      data: { items: created, count: created.length },
    })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/inventory/check-in" })
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    )
  }
}
