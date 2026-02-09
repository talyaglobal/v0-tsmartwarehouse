import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"

export interface InvoiceTemplate {
  id: string
  name: string
  description?: string
  htmlContent?: string
  companyId?: string
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from("invoice_templates")
      .select("id, name, description, html_content, company_id, is_system, is_active, created_at, updated_at")
      .eq("is_active", true)
      .order("name")

    if (error) throw new Error(error.message)

    const templates: InvoiceTemplate[] = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      htmlContent: row.html_content ?? undefined,
      companyId: row.company_id ?? undefined,
      isSystem: Boolean(row.is_system),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    const err = handleApiError(error, { path: "/api/v1/invoice-templates" })
    return NextResponse.json({ success: false, error: err.message, statusCode: err.statusCode } as ErrorResponse, { status: err.statusCode })
  }
}
