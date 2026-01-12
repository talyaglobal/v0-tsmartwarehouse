import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

// Validation schema for company service update
const companyServiceUpdateSchema = z.object({
  serviceName: z.string().min(1).max(255).optional(),
  serviceDescription: z.string().optional(),
  pricingType: z.enum(['one_time', 'per_pallet', 'per_sqft', 'per_day', 'per_month']).optional(),
  basePrice: z.number().min(0).optional(),
  isActive: z.boolean().optional()
})

/**
 * GET /api/v1/company-services/[id]
 * Get a specific company service
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { id } = await params
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

    // Get company service
    const { data: service, error } = await supabase
      .from('company_services')
      .select('*')
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .single()

    if (error || !service) {
      return NextResponse.json({
        success: false,
        error: "Company service not found",
        statusCode: 404
      } as ErrorResponse, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { service }
    })
  } catch (error) {
    const errorResponse = handleApiError(error, {
      context: 'Failed to get company service'
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
 * PATCH /api/v1/company-services/[id]
 * Update a company service (requires company_admin or root role)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { id } = await params
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

    // Check if user is company admin, warehouse owner, or root
    if (profile.role !== 'root' && profile.role !== 'company_admin' && profile.role !== 'warehouse_admin') {
      return NextResponse.json({
        success: false,
        error: "Only company admins and warehouse owners can update company services",
        statusCode: 403
      } as ErrorResponse, { status: 403 })
    }

    // Check if service exists and belongs to user's company
    const { data: existingService } = await supabase
      .from('company_services')
      .select('id')
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .single()

    if (!existingService) {
      return NextResponse.json({
        success: false,
        error: "Company service not found",
        statusCode: 404
      } as ErrorResponse, { status: 404 })
    }

    // Validate request body
    const body = await request.json()
    const validatedData = companyServiceUpdateSchema.parse(body)

    // Build update object
    const updates: any = {}
    if (validatedData.serviceName !== undefined) updates.service_name = validatedData.serviceName
    if (validatedData.serviceDescription !== undefined) updates.service_description = validatedData.serviceDescription
    if (validatedData.pricingType !== undefined) updates.pricing_type = validatedData.pricingType
    if (validatedData.basePrice !== undefined) updates.base_price = validatedData.basePrice
    if (validatedData.isActive !== undefined) updates.is_active = validatedData.isActive

    // Update company service
    const { data: service, error } = await supabase
      .from('company_services')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update company service: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      data: { service }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: error.errors[0].message,
        statusCode: 400
      } as ErrorResponse, { status: 400 })
    }

    const errorResponse = handleApiError(error, {
      context: 'Failed to update company service'
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
 * DELETE /api/v1/company-services/[id]
 * Delete a company service (requires company_admin or root role)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { id } = await params
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

    // Check if user is company admin, warehouse owner, or root
    if (profile.role !== 'root' && profile.role !== 'company_admin' && profile.role !== 'warehouse_admin') {
      return NextResponse.json({
        success: false,
        error: "Only company admins and warehouse owners can delete company services",
        statusCode: 403
      } as ErrorResponse, { status: 403 })
    }

    // Check if service exists and belongs to user's company
    const { data: existingService } = await supabase
      .from('company_services')
      .select('id')
      .eq('id', id)
      .eq('company_id', profile.company_id)
      .single()

    if (!existingService) {
      return NextResponse.json({
        success: false,
        error: "Company service not found",
        statusCode: 404
      } as ErrorResponse, { status: 404 })
    }

    // Delete company service
    const { error } = await supabase
      .from('company_services')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete company service: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: "Company service deleted successfully"
    })
  } catch (error) {
    const errorResponse = handleApiError(error, {
      context: 'Failed to delete company service'
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

