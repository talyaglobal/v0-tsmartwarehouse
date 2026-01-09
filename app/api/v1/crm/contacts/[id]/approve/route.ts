import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, requireRole } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const approveContactSchema = z.object({
  action: z.enum(["request", "approve", "reject"]),
  notes: z.string().max(1000).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const resolvedParams = await Promise.resolve(params)
    const contactId = resolvedParams.id

    const supabase = createServerSupabaseClient()

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single()

    if (!profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "User profile not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Get contact
    const { data: contact, error: contactError } = await supabase
      .from("crm_contacts")
      .select("*")
      .eq("id", contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    let validatedData
    try {
      validatedData = approveContactSchema.parse(body)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        const errorData: ErrorResponse = {
          success: false,
          error: "Validation error",
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: zodError.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", "),
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    const updateData: Record<string, any> = {}

    if (validatedData.action === "request") {
      // User requesting approval
      if (contact.created_by !== user.id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }

      updateData.requires_approval = true
      updateData.approval_requested_at = new Date().toISOString()
      if (validatedData.notes) {
        updateData.approval_notes = validatedData.notes
      }
    } else if (validatedData.action === "approve") {
      // Admin approving
      if (!["root", "warehouse_admin", "warehouse_owner"].includes(profile.role)) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }

      // Check company access for admins
      if (profile.role !== "root" && profile.company_id && contact.company_id !== profile.company_id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }

      updateData.status = "approved"
      updateData.requires_approval = false
      updateData.approved_by = user.id
      updateData.approved_at = new Date().toISOString()
      if (validatedData.notes) {
        updateData.approval_notes = validatedData.notes
      }
    } else if (validatedData.action === "reject") {
      // Admin rejecting
      if (!["root", "warehouse_admin", "warehouse_owner"].includes(profile.role)) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }

      // Check company access for admins
      if (profile.role !== "root" && profile.company_id && contact.company_id !== profile.company_id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }

      updateData.status = "rejected"
      updateData.requires_approval = false
      updateData.approved_by = user.id
      updateData.approved_at = new Date().toISOString()
      if (validatedData.notes) {
        updateData.approval_notes = validatedData.notes
      }
    }

    const { data: updatedContact, error } = await supabase
      .from("crm_contacts")
      .update(updateData)
      .eq("id", contactId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: updatedContact })
  } catch (error) {
    return handleApiError(error, "Failed to process approval request")
  }
}

