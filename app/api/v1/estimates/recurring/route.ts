import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getEstimates, createEstimate } from "@/lib/db/estimates"
import { requireAuth } from "@/lib/auth/api-middleware"
import type { ErrorResponse } from "@/types/api"

/**
 * POST /api/v1/estimates/recurring
 * Create estimates for recurring (monthly) entries at end of month.
 * Call from cron (e.g. last day of month) or manually by admin.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", authResult.user.id).maybeSingle()
    const role = profile?.role ?? authResult.user.role
    if (role !== "root" && role !== "warehouse_admin") {
      return NextResponse.json(
        { success: false, error: "Only admin can run recurring estimates", statusCode: 403 } as ErrorResponse,
        { status: 403 }
      )
    }

    const now = new Date()
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const isLastDay = now.getDate() >= lastDayOfMonth.getDate()

    const estimates = await getEstimates({ isRecurring: true })
    const created: string[] = []

    for (const est of estimates) {
      if (est.recurringInterval !== "monthly") continue
      const estimateDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfMonth.getDate()).padStart(2, "0")}`
      const { data: existing } = await supabase
        .from("estimates")
        .select("id")
        .eq("customer_id", est.customerId)
        .eq("estimate_date", estimateDate)
        .eq("is_recurring", true)
        .limit(1)
        .maybeSingle()
      if (existing) continue

      const newEst = await createEstimate({
        customerId: est.customerId,
        customerName: est.customerName,
        customerEmail: est.customerEmail,
        items: est.items,
        subtotal: est.subtotal,
        tax: est.tax,
        total: est.total,
        dueDate: undefined,
        isRecurring: true,
        recurringInterval: "monthly",
        estimateDate,
      })
      created.push(newEst.id)
    }

    return NextResponse.json({
      success: true,
      data: { created: created.length, ids: created },
      message: isLastDay ? `Recurring estimates run for month end. Created: ${created.length}` : `Created ${created.length} recurring estimates.`,
    })
  } catch (error) {
    console.error("Recurring estimates error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Recurring estimates failed", statusCode: 500 } as ErrorResponse,
      { status: 500 }
    )
  }
}
