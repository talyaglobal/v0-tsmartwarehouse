import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const moveStageSchema = z.object({
  pipelineStage: z.number().int().min(0).max(100),
  reason: z.string().max(500).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> | { contactId: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const resolvedParams = await Promise.resolve(params)
    const contactId = resolvedParams.contactId

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

    // Check if contact exists and user has permission
    const { data: contact } = await supabase
      .from("crm_contacts")
      .select("created_by, company_id, contact_type, pipeline_stage")
      .eq("id", contactId)
      .single()

    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      )
    }

    // Check permissions
    if (profile.role === "root") {
      // Root can update all
    } else if (["warehouse_admin", "warehouse_admin"].includes(profile.role) && profile.company_id) {
      if (contact.company_id !== profile.company_id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }
    } else {
      if (contact.created_by !== user.id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }
    }

    // Parse and validate request body
    const body = await request.json()
    let validatedData
    try {
      validatedData = moveStageSchema.parse(body)
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

    // Get milestone for the new stage
    const { data: milestone } = await supabase
      .from("crm_pipeline_milestones")
      .select("milestone_name")
      .eq("pipeline_type", contact.contact_type)
      .eq("stage_percentage", validatedData.pipelineStage)
      .single()

    if (!milestone) {
      return NextResponse.json(
        { success: false, error: "Invalid pipeline stage" },
        { status: 400 }
      )
    }

    // Update contact
    const updateData: Record<string, any> = {
      pipeline_stage: validatedData.pipelineStage,
      pipeline_milestone: milestone.milestone_name,
    }

    const { data: updatedContact, error: updateError } = await supabase
      .from("crm_contacts")
      .update(updateData)
      .eq("id", contactId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    // Create activity log for stage change
    await supabase
      .from("crm_activities")
      .insert({
        contact_id: contactId,
        created_by: user.id,
        company_id: profile.company_id,
        activity_type: "note",
        subject: `Pipeline stage changed from ${contact.pipeline_stage}% to ${validatedData.pipelineStage}%`,
        description: validatedData.reason || `Moved to ${milestone.milestone_name}`,
        moved_to_stage: validatedData.pipelineStage,
        stage_change_reason: validatedData.reason || null,
      })

    return NextResponse.json({ success: true, data: updatedContact })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to move contact to new stage" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

