import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const createActivitySchema = z.object({
  contactId: z.string().uuid(),
  activityType: z.enum(["visit", "call", "email", "meeting", "note", "task", "proposal_sent", "contract_sent", "follow_up"]),
  subject: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  outcome: z.enum(["successful", "needs_follow_up", "not_interested", "callback_requested"]).optional(),
  // Visit specific
  visitDate: z.string().optional(),
  visitLocation: z.string().max(500).optional(),
  visitDurationMinutes: z.number().int().positive().optional(),
  visitNotes: z.string().max(5000).optional(),
  visitPhotos: z.array(z.string()).optional(),
  propertyCondition: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  ownerInterestLevel: z.enum(["very_interested", "interested", "neutral", "not_interested"]).optional(),
  // Call/Email specific
  callDurationMinutes: z.number().int().positive().optional(),
  callRecordingUrl: z.string().url().optional(),
  emailSentAt: z.string().optional(),
  emailOpened: z.boolean().optional(),
  emailClicked: z.boolean().optional(),
  // Task management
  isTask: z.boolean().optional(),
  taskDueDate: z.string().optional(),
  // Pipeline impact
  movedToStage: z.number().int().min(0).max(100).optional(),
  stageChangeReason: z.string().max(500).optional(),
  // Metadata
  attachments: z.array(z.object({
    url: z.string().url(),
    name: z.string(),
    type: z.string(),
  })).optional(),
  tags: z.array(z.string()).optional(),
})

const activitiesQuerySchema = z.object({
  contact_id: z.string().uuid().optional(),
  activity_type: z.enum(["visit", "call", "email", "meeting", "note", "task", "proposal_sent", "contract_sent", "follow_up"]).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional(),
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
      validatedParams = activitiesQuerySchema.parse(queryParams)
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

    // Build query - join with contacts to filter by ownership
    let query = supabase
      .from("crm_activities")
      .select(`
        *,
        crm_contacts!inner(created_by, company_id)
      `)
      .order("created_at", { ascending: false })

    // Apply role-based filtering through contact ownership
    if (profile.role === "root") {
      // Root can see all
    } else if (["warehouse_admin", "warehouse_admin"].includes(profile.role) && profile.company_id) {
      query = query.eq("crm_contacts.company_id", profile.company_id)
    } else {
      // Users can only see activities for their own contacts
      query = query.eq("crm_contacts.created_by", user.id)
    }

    // Apply filters
    if (validatedParams.contact_id) {
      query = query.eq("contact_id", validatedParams.contact_id)
    }
    if (validatedParams.activity_type) {
      query = query.eq("activity_type", validatedParams.activity_type)
    }
    if (validatedParams.start_date) {
      query = query.gte("created_at", validatedParams.start_date)
    }
    if (validatedParams.end_date) {
      query = query.lte("created_at", validatedParams.end_date)
    }

    // Apply pagination
    const limit = validatedParams.limit || 50
    const offset = validatedParams.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Flatten the response (remove nested contact data)
    const activities = (data || []).map((activity: any) => {
      const { crm_contacts: _crm_contacts, ...rest } = activity
      return rest
    })

    return NextResponse.json({ success: true, data: activities })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to fetch CRM activities" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json()
    let validatedData
    try {
      validatedData = createActivitySchema.parse(body)
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

    // Verify contact exists and user has permission
    const { data: contact } = await supabase
      .from("crm_contacts")
      .select("created_by, company_id")
      .eq("id", validatedData.contactId)
      .single()

    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      )
    }

    // Check permissions
    if (profile.role === "root") {
      // Root can create activities for all contacts
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

    // Insert activity
    const { data: activity, error } = await supabase
      .from("crm_activities")
      .insert({
        contact_id: validatedData.contactId,
        created_by: user.id,
        company_id: profile.company_id,
        activity_type: validatedData.activityType,
        subject: validatedData.subject,
        description: validatedData.description || null,
        outcome: validatedData.outcome || null,
        visit_date: validatedData.visitDate || null,
        visit_location: validatedData.visitLocation || null,
        visit_duration_minutes: validatedData.visitDurationMinutes || null,
        visit_notes: validatedData.visitNotes || null,
        visit_photos: validatedData.visitPhotos || null,
        property_condition: validatedData.propertyCondition || null,
        owner_interest_level: validatedData.ownerInterestLevel || null,
        call_duration_minutes: validatedData.callDurationMinutes || null,
        call_recording_url: validatedData.callRecordingUrl || null,
        email_sent_at: validatedData.emailSentAt || null,
        email_opened: validatedData.emailOpened || false,
        email_clicked: validatedData.emailClicked || false,
        is_task: validatedData.isTask || false,
        task_due_date: validatedData.taskDueDate || null,
        moved_to_stage: validatedData.movedToStage || null,
        stage_change_reason: validatedData.stageChangeReason || null,
        attachments: validatedData.attachments || [],
        tags: validatedData.tags || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // If activity moved contact to a new stage, update contact
    if (validatedData.movedToStage !== undefined) {
      // Get milestone for the new stage
      const { data: contactData } = await supabase
        .from("crm_contacts")
        .select("contact_type")
        .eq("id", validatedData.contactId)
        .single()

      if (contactData) {
        const { data: milestone } = await supabase
          .from("crm_pipeline_milestones")
          .select("milestone_name")
          .eq("pipeline_type", contactData.contact_type)
          .eq("stage_percentage", validatedData.movedToStage)
          .single()

        if (milestone) {
          await supabase
            .from("crm_contacts")
            .update({
              pipeline_stage: validatedData.movedToStage,
              pipeline_milestone: milestone.milestone_name,
            })
            .eq("id", validatedData.contactId)
        }
      }
    }

    return NextResponse.json({ success: true, data: activity }, { status: 201 })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to create CRM activity" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

