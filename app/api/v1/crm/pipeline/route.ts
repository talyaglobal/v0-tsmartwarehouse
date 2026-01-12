import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const pipelineQuerySchema = z.object({
  contact_type: z.enum(["warehouse_supplier", "customer_lead"]).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
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

    // Validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams: Record<string, string | undefined> = {}
    searchParams.forEach((value, key) => {
      queryParams[key] = value
    })

    let validatedParams
    try {
      validatedParams = pipelineQuerySchema.parse(queryParams)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        const errorData: ErrorResponse = {
          success: false,
          error: "Invalid query parameters",
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: zodError.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", "),
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    // Determine contact type based on role if not specified
    let contactType = validatedParams.contact_type
    if (!contactType) {
      if (profile.role === "warehouse_finder") {
        contactType = "warehouse_supplier"
      } else if (profile.role === "warehouse_broker") {
        contactType = "customer_lead"
      }
    }

    // Get all milestones for the contact type
    let milestonesQuery = supabase
      .from("crm_pipeline_milestones")
      .select("*")
      .eq("is_active", true)
      .order("stage_percentage", { ascending: true })

    if (contactType) {
      milestonesQuery = milestonesQuery.eq("pipeline_type", contactType)
    }

    const { data: milestones, error: milestonesError } = await milestonesQuery

    if (milestonesError) {
      return NextResponse.json(
        { success: false, error: milestonesError.message },
        { status: 500 }
      )
    }

    // Build query for contacts
    let contactsQuery = supabase
      .from("crm_contacts")
      .select("*")
      .in("status", ["active", "approved"])
      .order("updated_at", { ascending: false })

    // Apply role-based filtering
    if (profile.role === "root") {
      // Root can see all
    } else if (["warehouse_admin", "warehouse_admin"].includes(profile.role) && profile.company_id) {
      contactsQuery = contactsQuery.eq("company_id", profile.company_id)
    } else {
      contactsQuery = contactsQuery.eq("created_by", user.id)
    }

    if (contactType) {
      contactsQuery = contactsQuery.eq("contact_type", contactType)
    }

    const { data: contacts, error: contactsError } = await contactsQuery

    if (contactsError) {
      return NextResponse.json(
        { success: false, error: contactsError.message },
        { status: 500 }
      )
    }

    // Group contacts by pipeline stage
    const pipelineOverview = (milestones || []).map((milestone) => {
      const stageContacts = (contacts || []).filter(
        (contact) => contact.pipeline_stage === milestone.stage_percentage
      )

      return {
        stage: milestone.stage_number,
        percentage: milestone.stage_percentage,
        milestoneName: milestone.milestone_name,
        milestoneDescription: milestone.milestone_description,
        contactCount: stageContacts.length,
        contacts: stageContacts,
      }
    })

    return NextResponse.json({ success: true, data: pipelineOverview })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to fetch pipeline overview" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

