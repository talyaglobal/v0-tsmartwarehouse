import { type NextRequest, NextResponse } from "next/server"
import { getEstimateById } from "@/lib/db/estimates"
import { createInvoice } from "@/lib/db/invoices"
import { updateEstimate } from "@/lib/db/estimates"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendInvoiceEmail } from "@/lib/email/resend-invoice"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const bodySchema = z.object({
  templateId: z.string().uuid().optional(),
  sendEmail: z.boolean().optional(),
  toEmail: z.string().email().optional(),
})

export async function POST(
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
        { success: false, error: "Only admin can create invoice from estimate", statusCode: 403 } as ErrorResponse,
        { status: 403 }
      )
    }

    const { id: estimateId } = await params
    const estimate = await getEstimateById(estimateId)
    if (!estimate) {
      return NextResponse.json({ success: false, error: "Estimate not found", statusCode: 404 } as ErrorResponse, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    const { templateId, sendEmail, toEmail } = parsed.success ? parsed.data : {}

    const dueDate = estimate.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const invoice = await createInvoice({
      estimateId,
      bookingId: estimate.bookingId ?? undefined,
      serviceOrderId: estimate.serviceOrderId ?? undefined,
      customerId: estimate.customerId,
      customerName: estimate.customerName,
      status: "pending",
      items: estimate.items,
      subtotal: estimate.subtotal,
      tax: estimate.tax,
      total: estimate.total,
      dueDate,
    })

    await updateEstimate(estimateId, { status: "converted" })

    let emailSent = false
    const emailTo = toEmail ?? estimate.customerEmail
    if (sendEmail && emailTo) {
      const result = await sendInvoiceEmail(
        { ...invoice, dueDate },
        emailTo
      )
      emailSent = result.ok
    }

    return NextResponse.json({
      success: true,
      data: { invoice, emailSent },
      message: emailSent ? "Invoice created and email sent" : "Invoice created",
    })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/estimates/[id]/create-invoice", method: "POST" })
    return NextResponse.json({ success: false, error: err.message, statusCode: err.statusCode } as ErrorResponse, { status: err.statusCode })
  }
}
