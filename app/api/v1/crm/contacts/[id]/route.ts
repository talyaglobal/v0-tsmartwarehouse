import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const updateContactSchema = z.object({
  contactName: z.string().min(1).max(200).optional(),
  companyName: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  secondaryPhone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  warehouseSizeSqm: z.number().positive().optional(),
  warehouseType: z.array(z.string()).optional(),
  availableServices: z.array(z.string()).optional(),
  estimatedCapacity: z.number().int().positive().optional(),
  currentUtilizationPercent: z.number().int().min(0).max(100).optional(),
  industry: z.string().max(100).optional(),
  companySize: z.enum(["startup", "small", "medium", "large", "enterprise"]).optional(),
  estimatedSpaceNeedSqm: z.number().positive().optional(),
  budgetRange: z.string().max(100).optional(),
  decisionMakerName: z.string().max(200).optional(),
  decisionMakerTitle: z.string().max(200).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  status: z.enum(["active", "approved", "rejected", "converted", "inactive", "archived"]).optional(),
  pipelineStage: z.number().int().min(0).max(100).optional(),
  pipelineMilestone: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
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
    const query = supabase
      .from("crm_contacts")
      .select("*")
      .eq("id", contactId)
      .single()

    const { data: contact, error } = await query

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Contact not found" },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Check permissions
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

    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to fetch CRM contact" })
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

    // Check if contact exists and user has permission
    const { data: existingContact } = await supabase
      .from("crm_contacts")
      .select("created_by, company_id")
      .eq("id", contactId)
      .single()

    if (!existingContact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      )
    }

    // Check permissions
    if (profile.role === "root") {
      // Root can update all
    } else if (["warehouse_admin", "warehouse_admin"].includes(profile.role) && profile.company_id) {
      if (existingContact.company_id !== profile.company_id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }
    } else {
      if (existingContact.created_by !== user.id) {
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
      validatedData = updateContactSchema.parse(body)
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

    if (validatedData.contactName !== undefined) updateData.contact_name = validatedData.contactName
    if (validatedData.companyName !== undefined) updateData.company_name = validatedData.companyName
    if (validatedData.email !== undefined) updateData.email = validatedData.email || null
    if (validatedData.phone !== undefined) updateData.phone = validatedData.phone || null
    if (validatedData.secondaryPhone !== undefined) updateData.secondary_phone = validatedData.secondaryPhone || null
    if (validatedData.address !== undefined) updateData.address = validatedData.address || null
    if (validatedData.city !== undefined) updateData.city = validatedData.city || null
    if (validatedData.state !== undefined) updateData.state = validatedData.state || null
    if (validatedData.country !== undefined) updateData.country = validatedData.country || null
    if (validatedData.postalCode !== undefined) updateData.postal_code = validatedData.postalCode || null
    if (validatedData.warehouseSizeSqm !== undefined) updateData.warehouse_size_sqm = validatedData.warehouseSizeSqm || null
    if (validatedData.warehouseType !== undefined) updateData.warehouse_type = validatedData.warehouseType || null
    if (validatedData.availableServices !== undefined) updateData.available_services = validatedData.availableServices || null
    if (validatedData.estimatedCapacity !== undefined) updateData.estimated_capacity = validatedData.estimatedCapacity || null
    if (validatedData.currentUtilizationPercent !== undefined) updateData.current_utilization_percent = validatedData.currentUtilizationPercent || null
    if (validatedData.industry !== undefined) updateData.industry = validatedData.industry || null
    if (validatedData.companySize !== undefined) updateData.company_size = validatedData.companySize || null
    if (validatedData.estimatedSpaceNeedSqm !== undefined) updateData.estimated_space_need_sqm = validatedData.estimatedSpaceNeedSqm || null
    if (validatedData.budgetRange !== undefined) updateData.budget_range = validatedData.budgetRange || null
    if (validatedData.decisionMakerName !== undefined) updateData.decision_maker_name = validatedData.decisionMakerName || null
    if (validatedData.decisionMakerTitle !== undefined) updateData.decision_maker_title = validatedData.decisionMakerTitle || null
    if (validatedData.priority !== undefined) updateData.priority = validatedData.priority
    if (validatedData.tags !== undefined) updateData.tags = validatedData.tags || null
    if (validatedData.customFields !== undefined) updateData.custom_fields = validatedData.customFields
    if (validatedData.status !== undefined) updateData.status = validatedData.status
    if (validatedData.pipelineStage !== undefined) updateData.pipeline_stage = validatedData.pipelineStage
    if (validatedData.pipelineMilestone !== undefined) updateData.pipeline_milestone = validatedData.pipelineMilestone
    if (validatedData.nextFollowUpDate !== undefined) updateData.next_follow_up_date = validatedData.nextFollowUpDate || null

    // Update location if lat/lng provided
    if (validatedData.latitude !== undefined && validatedData.longitude !== undefined) {
      updateData.location = `SRID=4326;POINT(${validatedData.longitude} ${validatedData.latitude})`
    }

    const { data: contact, error } = await supabase
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

    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to update CRM contact" })
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

    // Check if contact exists and user has permission
    const { data: existingContact } = await supabase
      .from("crm_contacts")
      .select("created_by, company_id")
      .eq("id", contactId)
      .single()

    if (!existingContact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      )
    }

    // Check permissions
    if (profile.role === "root") {
      // Root can delete all
    } else if (["warehouse_admin", "warehouse_admin"].includes(profile.role) && profile.company_id) {
      if (existingContact.company_id !== profile.company_id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }
    } else {
      if (existingContact.created_by !== user.id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        )
      }
    }

    // Archive instead of delete (soft delete)
    const { error } = await supabase
      .from("crm_contacts")
      .update({ status: "archived" })
      .eq("id", contactId)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: "Contact archived successfully" })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to delete CRM contact" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

