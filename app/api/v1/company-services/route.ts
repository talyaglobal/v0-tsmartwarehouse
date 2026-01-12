import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

// Validation schema for company service
const companyServiceSchema = z.object({
  serviceName: z.string().min(1, "Service name is required").max(255),
  serviceDescription: z.string().optional(),
  pricingType: z.enum(['one_time', 'per_pallet', 'per_sqft', 'per_day', 'per_month']),
  basePrice: z.number().min(0, "Price must be positive"),
  isActive: z.boolean().optional().default(true)
})

/**
 * GET /api/v1/company-services
 * Get all company services for the authenticated user's company
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const supabase = await createServerSupabaseClient()

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .eq('status', true)
      .single()

    if (!profile || !profile.company_id) {
      return NextResponse.json({
        success: false,
        error: "User profile or company not found",
        statusCode: 404
      } as ErrorResponse, { status: 404 })
    }

    // Get all company services
    const { data: services, error } = await supabase
      .from('company_services')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch company services: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      data: { services: services || [] }
    })
  } catch (error) {
    const errorResponse = handleApiError(error, {
      context: 'Failed to get company services'
    })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * POST /api/v1/company-services
 * Create a new company service (requires company_admin or root role)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const supabase = await createServerSupabaseClient()

    // Get user's company and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .eq('status', true)
      .single()

    if (!profile || !profile.company_id) {
      return NextResponse.json({
        success: false,
        error: "User profile or company not found",
        statusCode: 404
      } as ErrorResponse, { status: 404 })
    }

    // Check if user is warehouse_admin, warehouse_supervisor, or root
    if (profile.role !== 'root' && profile.role !== 'warehouse_supervisor' && profile.role !== 'warehouse_admin') {
      return NextResponse.json({
        success: false,
        error: "Only company admins and warehouse owners can create company services",
        statusCode: 403
      } as ErrorResponse, { status: 403 })
    }

    // Validate request body
    const body = await request.json()
    const validatedData = companyServiceSchema.parse(body)

    // Create company service
    const { data: service, error } = await supabase
      .from('company_services')
      .insert({
        company_id: profile.company_id,
        service_name: validatedData.serviceName,
        service_description: validatedData.serviceDescription,
        pricing_type: validatedData.pricingType,
        base_price: validatedData.basePrice,
        is_active: validatedData.isActive
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create company service: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      data: { service }
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: error.errors[0].message,
        statusCode: 400
      } as ErrorResponse, { status: 400 })
    }

    const errorResponse = handleApiError(error, {
      context: 'Failed to create company service'
    })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

