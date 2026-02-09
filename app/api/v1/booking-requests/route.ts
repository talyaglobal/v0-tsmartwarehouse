import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ApiResponse, ErrorResponse } from "@/types/api"

/**
 * POST /api/v1/booking-requests
 * Create a booking request (quote request). Customer or team member on behalf can submit.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const {
      customerId,
      averagePalletDays,
      requestedFloor,
      ownerOfProduct,
      skuCount,
      isSingleType,
      notes,
      requiresApproval,
      poInfo,
      isLabellingRequired,
    } = body

    const userId = authResult.user.id

    // Customer: who the request is for (self or on-behalf). If omitted, use current user.
    const customerIdResolved = customerId ?? userId

    if (!averagePalletDays || averagePalletDays < 1) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Average pallet days (min 1) is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (!skuCount || skuCount < 1) {
      const errorData: ErrorResponse = {
        success: false,
        error: "SKU count (min 1) is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    const { data: row, error } = await supabase
      .from("booking_requests")
      .insert({
        customer_id: customerIdResolved,
        requested_by_id: customerIdResolved === userId ? null : userId,
        average_pallet_days: Number(averagePalletDays),
        requested_floor: requestedFloor?.trim() || null,
        owner_of_product: ownerOfProduct?.trim() || null,
        sku_count: Number(skuCount),
        is_single_type: Boolean(isSingleType),
        notes: notes?.trim() || null,
        requires_approval: requiresApproval !== false,
        po_info: poInfo != null ? String(poInfo).trim() || null : null,
        is_labelling_required: Boolean(isLabellingRequired),
      })
      .select("id, status, created_at")
      .single()

    if (error) {
      const errorData: ErrorResponse = {
        success: false,
        error: error.message,
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    const responseData: ApiResponse = {
      success: true,
      data: { request: row },
      message: "Booking request submitted",
    }
    return NextResponse.json(responseData, { status: 201 })
  } catch (error) {
    const errorResponse = handleApiError(error, {
      path: "/api/v1/booking-requests",
      method: "POST",
    })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * GET /api/v1/booking-requests
 * List booking requests for the current user (as customer or requester).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const userId = authResult.user.id
    const supabase = await createServerSupabaseClient()
    const { data: rows, error } = await supabase
      .from("booking_requests")
      .select("*")
      .or(`customer_id.eq.${userId},requested_by_id.eq.${userId}`)
      .order("created_at", { ascending: false })

    if (error) {
      const errorData: ErrorResponse = {
        success: false,
        error: error.message,
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    const { isCompanyAdmin } = await import("@/lib/auth/company-admin")
    const customerIds = [...new Set((rows ?? []).map((r: { customer_id: string }) => r.customer_id))]
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, company_id")
      .in("id", customerIds)
    const companyByCustomer = (profiles ?? []).reduce((acc: Record<string, string | null>, p: { id: string; company_id: string | null }) => {
      acc[p.id] = p.company_id ?? null
      return acc
    }, {})

    const requestsWithFlags = await Promise.all(
      (rows ?? []).map(async (r: Record<string, unknown>) => {
        const isOwner = r.requested_by_id === userId || r.customer_id === userId
        const customerCompanyId = companyByCustomer[r.customer_id as string] ?? null
        const adminCan = customerCompanyId ? await isCompanyAdmin(userId, customerCompanyId) : false
        const can_edit = isOwner || adminCan
        const can_delete = isOwner || adminCan
        return { ...r, can_edit, can_delete }
      })
    )

    const responseData: ApiResponse = {
      success: true,
      data: { requests: requestsWithFlags },
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, {
      path: "/api/v1/booking-requests",
      method: "GET",
    })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
