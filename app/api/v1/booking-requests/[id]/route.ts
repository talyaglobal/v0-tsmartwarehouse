import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin } from "@/lib/auth/company-admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"

async function canManageRequest(
  userId: string,
  request: { customer_id: string; requested_by_id: string | null }
): Promise<boolean> {
  if (request.requested_by_id === userId || request.customer_id === userId) return true
  const supabase = await createServerSupabaseClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", request.customer_id)
    .single()
  const customerCompanyId = profile?.company_id
  if (!customerCompanyId) return false
  return isCompanyAdmin(userId, customerCompanyId)
}

/**
 * PATCH /api/v1/booking-requests/[id]
 * Update a booking request. Allowed for requester, customer, or company admin.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { data: row, error: fetchError } = await supabase
      .from("booking_requests")
      .select("id, customer_id, requested_by_id")
      .eq("id", id)
      .single()

    if (fetchError || !row) {
      return NextResponse.json(
        { success: false, error: "Booking request not found", statusCode: 404 },
        { status: 404 }
      )
    }

    const allowed = await canManageRequest(authResult.user.id, row)
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Not allowed to edit this request", statusCode: 403 },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (body.averagePalletDays != null) updates.average_pallet_days = Number(body.averagePalletDays)
    if (body.requestedFloor != null) updates.requested_floor = body.requestedFloor?.trim() || null
    if (body.ownerOfProduct != null) updates.owner_of_product = body.ownerOfProduct?.trim() || null
    if (body.skuCount != null) updates.sku_count = Number(body.skuCount)
    if (body.isSingleType != null) updates.is_single_type = Boolean(body.isSingleType)
    if (body.notes != null) updates.notes = body.notes?.trim() || null
    if (body.requiresApproval != null) updates.requires_approval = body.requiresApproval !== false

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true, data: row })
    }

    const { data: updated, error } = await supabase
      .from("booking_requests")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, statusCode: 500 },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/booking-requests/[id]", method: "PATCH" })
    return NextResponse.json({ success: false, error: err.message, statusCode: err.statusCode }, { status: err.statusCode })
  }
}

/**
 * DELETE /api/v1/booking-requests/[id]
 * Delete a booking request. Allowed for requester, customer, or company admin.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(_request)
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const { data: row, error: fetchError } = await supabase
      .from("booking_requests")
      .select("id, customer_id, requested_by_id")
      .eq("id", id)
      .single()

    if (fetchError || !row) {
      return NextResponse.json(
        { success: false, error: "Booking request not found", statusCode: 404 },
        { status: 404 }
      )
    }

    const allowed = await canManageRequest(authResult.user.id, row)
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Not allowed to delete this request", statusCode: 403 },
        { status: 403 }
      )
    }

    const { error } = await supabase.from("booking_requests").delete().eq("id", id)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, statusCode: 500 },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: "Request deleted" })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/booking-requests/[id]", method: "DELETE" })
    return NextResponse.json({ success: false, error: err.message, statusCode: err.statusCode }, { status: err.statusCode })
  }
}
