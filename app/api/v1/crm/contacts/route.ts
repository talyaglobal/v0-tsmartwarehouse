import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

// Validation schemas
const createContactSchema = z.object({
  contactName: z.string().min(1).max(200),
  companyName: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  secondaryPhone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional().default("Turkey"),
  postalCode: z.string().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  // Warehouse supplier fields
  warehouseSizeSqm: z.number().positive().optional(),
  warehouseType: z.array(z.string()).optional(),
  availableServices: z.array(z.string()).optional(),
  estimatedCapacity: z.number().int().positive().optional(),
  currentUtilizationPercent: z.number().int().min(0).max(100).optional(),
  // Customer lead fields
  industry: z.string().max(100).optional(),
  companySize: z.enum(["startup", "small", "medium", "large", "enterprise"]).optional(),
  estimatedSpaceNeedSqm: z.number().positive().optional(),
  budgetRange: z.string().max(100).optional(),
  decisionMakerName: z.string().max(200).optional(),
  decisionMakerTitle: z.string().max(200).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
})

const contactsQuerySchema = z.object({
  status: z.enum(["active", "approved", "rejected", "converted", "inactive", "archived"]).optional(),
  contact_type: z.enum(["warehouse_supplier", "customer_lead"]).optional(),
  pipeline_stage: z.string().regex(/^\d+$/).transform(Number).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  search: z.string().optional(),
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

    // Get user profile to check role and company
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
      validatedParams = contactsQuerySchema.parse(queryParams)
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

    // Build query
    let query = supabase
      .from("crm_contacts")
      .select("*")
      .order("updated_at", { ascending: false })

    // Apply role-based filtering
    if (profile.role === "root") {
      // Root can see all contacts
    } else if (["warehouse_admin", "warehouse_owner"].includes(profile.role) && profile.company_id) {
      // Admins can see contacts in their company
      query = query.eq("company_id", profile.company_id)
    } else {
      // Warehouse finders and resellers can only see their own contacts
      query = query.eq("created_by", user.id)
    }

    // Apply filters
    if (validatedParams.status) {
      query = query.eq("status", validatedParams.status)
    }
    if (validatedParams.contact_type) {
      query = query.eq("contact_type", validatedParams.contact_type)
    }
    if (validatedParams.pipeline_stage !== undefined) {
      query = query.eq("pipeline_stage", validatedParams.pipeline_stage)
    }
    if (validatedParams.priority) {
      query = query.eq("priority", validatedParams.priority)
    }
    if (validatedParams.search) {
      query = query.or(`contact_name.ilike.%${validatedParams.search}%,company_name.ilike.%${validatedParams.search}%,email.ilike.%${validatedParams.search}%`)
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

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to fetch CRM contacts" })
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

    // Get user profile to check role and company
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

    // Check if user has permission to create contacts
    if (!["warehouse_finder", "reseller", "root", "warehouse_admin"].includes(profile.role)) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Forbidden",
        statusCode: 403,
        message: "You do not have permission to create CRM contacts",
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Determine contact type based on role
    const contactType = profile.role === "warehouse_finder" ? "warehouse_supplier" : "customer_lead"

    // Parse and validate request body
    const body = await request.json()
    let validatedData
    try {
      validatedData = createContactSchema.parse(body)
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

    // Build location geography if lat/lng provided
    let locationValue = null
    if (validatedData.latitude !== undefined && validatedData.longitude !== undefined) {
      locationValue = `POINT(${validatedData.longitude} ${validatedData.latitude})`
    }

    // Get milestone for initial stage (10%)
    const { data: milestone } = await supabase
      .from("crm_pipeline_milestones")
      .select("milestone_name")
      .eq("pipeline_type", contactType)
      .eq("stage_percentage", 10)
      .single()

    // Insert contact
    const { data: contact, error } = await supabase
      .from("crm_contacts")
      .insert({
        created_by: user.id,
        company_id: profile.company_id,
        contact_type: contactType,
        contact_name: validatedData.contactName,
        company_name: validatedData.companyName,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        secondary_phone: validatedData.secondaryPhone || null,
        address: validatedData.address || null,
        city: validatedData.city || null,
        state: validatedData.state || null,
        country: validatedData.country || "Turkey",
        postal_code: validatedData.postalCode || null,
        location: locationValue ? `SRID=4326;${locationValue}` : null,
        // Warehouse supplier fields
        warehouse_size_sqm: validatedData.warehouseSizeSqm || null,
        warehouse_type: validatedData.warehouseType || null,
        available_services: validatedData.availableServices || null,
        estimated_capacity: validatedData.estimatedCapacity || null,
        current_utilization_percent: validatedData.currentUtilizationPercent || null,
        // Customer lead fields
        industry: validatedData.industry || null,
        company_size: validatedData.companySize || null,
        estimated_space_need_sqm: validatedData.estimatedSpaceNeedSqm || null,
        budget_range: validatedData.budgetRange || null,
        decision_maker_name: validatedData.decisionMakerName || null,
        decision_maker_title: validatedData.decisionMakerTitle || null,
        priority: validatedData.priority || "medium",
        tags: validatedData.tags || null,
        custom_fields: validatedData.customFields || {},
        pipeline_stage: 10,
        pipeline_milestone: milestone?.milestone_name || "contact_created",
        status: "active",
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: contact }, { status: 201 })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to create CRM contact" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

