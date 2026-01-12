import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const updateActivitySchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  outcome: z.enum(["successful", "needs_follow_up", "not_interested", "callback_requested"]).optional(),
  visitDate: z.string().optional(),
  visitLocation: z.string().max(500).optional(),
  visitDurationMinutes: z.number().int().positive().optional(),
  visitNotes: z.string().max(5000).optional(),
  visitPhotos: z.array(z.string()).optional(),
  propertyCondition: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  ownerInterestLevel: z.enum(["very_interested", "interested", "neutral", "not_interested"]).optional(),
  callDurationMinutes: z.number().int().positive().optional(),
  callRecordingUrl: z.string().url().optional(),
  emailOpened: z.boolean().optional(),
  emailClicked: z.boolean().optional(),
  taskCompleted: z.boolean().optional(),
  taskCompletedAt: z.string().optional(),
  attachments: z.array(z.object({
    url: z.string().url(),
    name: z.string(),
    type: z.string(),
  })).optional(),
  tags: z.array(z.string()).optional(),
})

export async function GET(
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
    const activityId = resolvedParams.id

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

    // Get activity with contact info
    const { data: activity, error } = await supabase
      .from("crm_activities")
      .select(`
        *,
        crm_contacts!inner(created_by, company_id)
      `)
      .eq("id", activityId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Activity not found" },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Check permissions through contact
    const contact = (activity as any).crm_contacts
    if (profile.role === "root") {
      // Root can see all
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

    // Remove nested contact data
    const { crm_contacts: _crm_contacts, ...activityData } = activity as any

    return NextResponse.json({ success: true, data: activityData })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to fetch CRM activity" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

export async function PATCH(
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
    const activityId = resolvedParams.id

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

    // Check if activity exists and user has permission
    const { data: existingActivity } = await supabase
      .from("crm_activities")
      .select(`
        created_by,
        crm_contacts!inner(created_by, company_id)
      `)
      .eq("id", activityId)
      .single()

    if (!existingActivity) {
      return NextResponse.json(
        { success: false, error: "Activity not found" },
        { status: 404 }
      )
    }

    // Check permissions
    const contact = (existingActivity as any).crm_contacts
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
      if (existingActivity.created_by !== user.id) {
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
      validatedData = updateActivitySchema.parse(body)
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

    // Build update object
    const updateData: Record<string, any> = {}

    if (validatedData.subject !== undefined) updateData.subject = validatedData.subject
    if (validatedData.description !== undefined) updateData.description = validatedData.description || null
    if (validatedData.outcome !== undefined) updateData.outcome = validatedData.outcome || null
    if (validatedData.visitDate !== undefined) updateData.visit_date = validatedData.visitDate || null
    if (validatedData.visitLocation !== undefined) updateData.visit_location = validatedData.visitLocation || null
    if (validatedData.visitDurationMinutes !== undefined) updateData.visit_duration_minutes = validatedData.visitDurationMinutes || null
    if (validatedData.visitNotes !== undefined) updateData.visit_notes = validatedData.visitNotes || null
    if (validatedData.visitPhotos !== undefined) updateData.visit_photos = validatedData.visitPhotos || null
    if (validatedData.propertyCondition !== undefined) updateData.property_condition = validatedData.propertyCondition || null
    if (validatedData.ownerInterestLevel !== undefined) updateData.owner_interest_level = validatedData.ownerInterestLevel || null
    if (validatedData.callDurationMinutes !== undefined) updateData.call_duration_minutes = validatedData.callDurationMinutes || null
    if (validatedData.callRecordingUrl !== undefined) updateData.call_recording_url = validatedData.callRecordingUrl || null
    if (validatedData.emailOpened !== undefined) updateData.email_opened = validatedData.emailOpened
    if (validatedData.emailClicked !== undefined) updateData.email_clicked = validatedData.emailClicked
    if (validatedData.taskCompleted !== undefined) {
      updateData.task_completed = validatedData.taskCompleted
      if (validatedData.taskCompleted && !validatedData.taskCompletedAt) {
        updateData.task_completed_at = new Date().toISOString()
      } else if (!validatedData.taskCompleted) {
        updateData.task_completed_at = null
      }
    }
    if (validatedData.taskCompletedAt !== undefined) updateData.task_completed_at = validatedData.taskCompletedAt || null
    if (validatedData.attachments !== undefined) updateData.attachments = validatedData.attachments
    if (validatedData.tags !== undefined) updateData.tags = validatedData.tags || null

    const { data: activity, error } = await supabase
      .from("crm_activities")
      .update(updateData)
      .eq("id", activityId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: activity })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to update CRM activity" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

export async function DELETE(
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
    const activityId = resolvedParams.id

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

    // Check if activity exists and user has permission
    const { data: existingActivity } = await supabase
      .from("crm_activities")
      .select(`
        created_by,
        crm_contacts!inner(created_by, company_id)
      `)
      .eq("id", activityId)
      .single()

    if (!existingActivity) {
      return NextResponse.json(
        { success: false, error: "Activity not found" },
        { status: 404 }
      )
    }

    // Check permissions
    const contact = (existingActivity as any).crm_contacts
    if (profile.role === "root") {
      // Root can delete all
    } else if (["warehouse_admin", "warehouse_admin"].includes(profile.role) && profile.company_id) {
      if (contact.company_id !== profile.company_id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }
    } else {
      if (existingActivity.created_by !== user.id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }
    }

    const { error } = await supabase
      .from("crm_activities")
      .delete()
      .eq("id", activityId)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: "Activity deleted successfully" })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to delete CRM activity" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

