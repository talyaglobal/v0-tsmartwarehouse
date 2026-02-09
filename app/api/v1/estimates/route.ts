import { type NextRequest, NextResponse } from "next/server"
import { getEstimates } from "@/lib/db/estimates"
import { createEstimate } from "@/lib/db/estimates"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { EstimateStatus } from "@/types"
import type { ApiResponse, ErrorResponse } from "@/types/api"
import { z } from "zod"

const createBodySchema = z.object({
  serviceOrderId: z.string().uuid().optional(),
  bookingId: z.string().optional(),
  customerId: z.string().uuid(),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    total: z.number(),
  })),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  dueDate: z.string().optional(),
  validUntil: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringInterval: z.enum(["monthly", "quarterly"]).optional(),
  estimateDate: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult

    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    const role = profile?.role ?? user.role

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId") ?? undefined
    const serviceOrderId = searchParams.get("serviceOrderId") ?? undefined
    const status = (searchParams.get("status") as EstimateStatus) ?? undefined
    const isRecurring = searchParams.get("isRecurring")
    const filters: { customerId?: string; serviceOrderId?: string; status?: EstimateStatus; isRecurring?: boolean } = {}

    if (role === "root" || role === "warehouse_admin") {
      if (customerId) filters.customerId = customerId
      if (serviceOrderId) filters.serviceOrderId = serviceOrderId
      if (status) filters.status = status
      if (isRecurring === "true") filters.isRecurring = true
      if (isRecurring === "false") filters.isRecurring = false
    } else {
      filters.customerId = user.id
    }

    const estimates = await getEstimates(filters)
    return NextResponse.json({ success: true, data: estimates, total: estimates.length } as ApiResponse<typeof estimates>)
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/estimates" })
    return NextResponse.json({ success: false, error: err.message, statusCode: err.statusCode } as ErrorResponse, { status: err.statusCode })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult

    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    const role = profile?.role ?? user.role
    if (role !== "root" && role !== "warehouse_admin") {
      return NextResponse.json(
        { success: false, error: "Only admin can create estimates", statusCode: 403 } as ErrorResponse,
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = createBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", statusCode: 400, code: "VALIDATION_ERROR" } as ErrorResponse,
        { status: 400 }
      )
    }

    const estimate = await createEstimate({
      serviceOrderId: parsed.data.serviceOrderId,
      bookingId: parsed.data.bookingId,
      customerId: parsed.data.customerId,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      items: parsed.data.items,
      subtotal: parsed.data.subtotal,
      tax: parsed.data.tax,
      total: parsed.data.total,
      dueDate: parsed.data.dueDate,
      validUntil: parsed.data.validUntil,
      isRecurring: parsed.data.isRecurring,
      recurringInterval: parsed.data.recurringInterval,
      estimateDate: parsed.data.estimateDate,
      notes: parsed.data.notes,
    })
    return NextResponse.json({ success: true, data: estimate, message: "Estimate created" } as ApiResponse<typeof estimate>, { status: 201 })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/estimates", method: "POST" })
    return NextResponse.json({ success: false, error: err.message, statusCode: err.statusCode } as ErrorResponse, { status: err.statusCode })
  }
}
