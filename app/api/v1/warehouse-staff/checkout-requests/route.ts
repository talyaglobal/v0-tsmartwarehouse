import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { getCheckoutRequestsForWarehouse } from "@/lib/db/checkout-requests"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/warehouse-staff/checkout-requests
 * List checkout requests for a warehouse (staff must be assigned to that warehouse).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const warehouseId = searchParams.get("warehouseId")
    const status = searchParams.get("status") as "pending_payment" | "paid" | "completed" | null

    if (!warehouseId) {
      return NextResponse.json(
        { success: false, error: "warehouseId required", statusCode: 400 } satisfies ErrorResponse,
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()
    const { data: staff } = await supabase
      .from("warehouse_staff")
      .select("user_id")
      .eq("warehouse_id", warehouseId)
      .eq("user_id", user.id)
      .eq("status", true)
      .maybeSingle()
    const { data: wh } = await supabase
      .from("warehouses")
      .select("owner_company_id")
      .eq("id", warehouseId)
      .single()
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()
    const isCompanyAdmin =
      wh?.owner_company_id && profile?.company_id === wh.owner_company_id
    if (!staff && !isCompanyAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden", statusCode: 403 } satisfies ErrorResponse,
        { status: 403 }
      )
    }

    const list = await getCheckoutRequestsForWarehouse({
      warehouseId,
      status: status ?? undefined,
    })
    return NextResponse.json({ success: true, data: list })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/warehouse-staff/checkout-requests" })
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    )
  }
}
