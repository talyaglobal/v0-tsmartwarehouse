import { type NextRequest, NextResponse } from "next/server"
import { getEstimateById, updateEstimate } from "@/lib/db/estimates"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(_request)
    if (authResult instanceof NextResponse) return authResult
    const { id } = await params
    const estimate = await getEstimateById(id)
    if (!estimate) {
      return NextResponse.json({ success: false, error: "Estimate not found", statusCode: 404 } as ErrorResponse, { status: 404 })
    }
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", authResult.user.id).maybeSingle()
    const role = profile?.role ?? authResult.user.role
    if (role !== "root" && role !== "warehouse_admin" && estimate.customerId !== authResult.user.id) {
      return NextResponse.json({ success: false, error: "Forbidden", statusCode: 403 } as ErrorResponse, { status: 403 })
    }
    return NextResponse.json({ success: true, data: estimate })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/estimates/[id]" })
    return NextResponse.json({ success: false, error: err.message, statusCode: err.statusCode } as ErrorResponse, { status: err.statusCode })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", authResult.user.id).maybeSingle()
    const role = profile?.role ?? authResult.user.role
    if (role !== "root" && role !== "warehouse_admin") {
      return NextResponse.json(
        { success: false, error: "Only admin can update estimates", statusCode: 403 } as ErrorResponse,
        { status: 403 }
      )
    }
    const { id } = await params
    const estimate = await getEstimateById(id)
    if (!estimate) {
      return NextResponse.json({ success: false, error: "Estimate not found", statusCode: 404 } as ErrorResponse, { status: 404 })
    }
    const body = await request.json()
    const updates: Parameters<typeof updateEstimate>[1] = {}
    if (body.status !== undefined) updates.status = body.status
    if (body.items !== undefined) updates.items = body.items
    if (body.subtotal !== undefined) updates.subtotal = body.subtotal
    if (body.tax !== undefined) updates.tax = body.tax
    if (body.total !== undefined) updates.total = body.total
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate
    if (body.validUntil !== undefined) updates.validUntil = body.validUntil
    if (body.notes !== undefined) updates.notes = body.notes
    const updated = await updateEstimate(id, updates)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/estimates/[id]", method: "PATCH" })
    return NextResponse.json({ success: false, error: err.message, statusCode: err.statusCode } as ErrorResponse, { status: err.statusCode })
  }
}
