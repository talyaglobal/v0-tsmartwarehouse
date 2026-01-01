import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

/**
 * GET /api/v1/warehouses/[id]/services
 * Get all services for a warehouse
 * If includeInactive query param is true, returns all services (active and inactive)
 * Otherwise, returns only active services (for public/customer view)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: warehouseId } = await params
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    
    const supabase = createServerSupabaseClient()

    let query = supabase
      .from('warehouse_services')
      .select(`
        *,
        company_services (
          id,
          service_name,
          service_description,
          pricing_type,
          base_price
        )
      `)
      .eq('warehouse_id', warehouseId)
      .eq('status', true) // Soft delete filter

    // Only filter by is_active if includeInactive is false
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query.order('service_name', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch services: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      data: {
        services: data || []
      }
    })
  } catch (error) {
    const errorResponse = handleApiError(error, {
      context: 'Failed to get warehouse services'
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

// Validation schema for service creation/update
const serviceSchema = z.object({
  serviceName: z.string().min(1, "Service name is required").max(255),
  serviceDescription: z.string().optional(),
  pricingType: z.enum(['one_time', 'per_pallet', 'per_sqft', 'per_day', 'per_month']),
  basePrice: z.number().min(0, "Price must be positive"),
  isActive: z.boolean().optional().default(true)
})

/**
 * POST /api/v1/warehouses/[id]/services
 * Create a new service for a warehouse (requires auth + ownership)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { id: warehouseId } = await params
    const supabase = await createServerSupabaseClient()

    // Check if user owns this warehouse
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('owner_company_id')
      .eq('id', warehouseId)
      .eq('status', true)
      .single()

    if (!warehouse) {
      return NextResponse.json({
        success: false,
        error: "Warehouse not found",
        statusCode: 404
      } as ErrorResponse, { status: 404 })
    }

    // Check if user belongs to the owner company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .eq('status', true)
      .single()

    if (!profile || profile.company_id !== warehouse.owner_company_id) {
      return NextResponse.json({
        success: false,
        error: "You don't have permission to manage services for this warehouse",
        statusCode: 403
      } as ErrorResponse, { status: 403 })
    }

    // Validate request body
    const body = await request.json()
    const validatedData = serviceSchema.parse(body)

    // Create service
    const { data: service, error } = await supabase
      .from('warehouse_services')
      .insert({
        warehouse_id: warehouseId,
        service_name: validatedData.serviceName,
        service_description: validatedData.serviceDescription,
        pricing_type: validatedData.pricingType,
        base_price: validatedData.basePrice,
        is_active: validatedData.isActive
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create service: ${error.message}`)
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
      context: 'Failed to create warehouse service'
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
