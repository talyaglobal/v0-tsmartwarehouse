import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

// Validation schema for mapping services
const mapServicesSchema = z.object({
  companyServiceIds: z.array(z.string().uuid()).min(1, "At least one service must be selected"),
  overridePrices: z.record(z.string().uuid(), z.number().min(0)).optional() // Optional price overrides per service
})

/**
 * POST /api/v1/warehouses/[id]/services/map
 * Map company services to a warehouse
 * Creates warehouse_services entries linked to company_services
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { id: warehouseId } = await params
    const supabase = await createServerSupabaseClient()

    // Get user's company
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
    if (profile.role !== 'root' && profile.role !== 'company_admin' && profile.role !== 'warehouse_owner') {
      return NextResponse.json({
        success: false,
        error: "Only company admins and warehouse owners can map services to warehouses",
        statusCode: 403
      } as ErrorResponse, { status: 403 })
    }

    // Check if warehouse exists and belongs to user's company
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

    if (warehouse.owner_company_id !== profile.company_id) {
      return NextResponse.json({
        success: false,
        error: "You don't have permission to manage services for this warehouse",
        statusCode: 403
      } as ErrorResponse, { status: 403 })
    }

    // Validate request body
    const body = await request.json()
    const validatedData = mapServicesSchema.parse(body)

    // Get company services to verify they belong to the user's company
    const { data: companyServices, error: servicesError } = await supabase
      .from('company_services')
      .select('*')
      .eq('company_id', profile.company_id)
      .in('id', validatedData.companyServiceIds)

    if (servicesError) {
      throw new Error(`Failed to fetch company services: ${servicesError.message}`)
    }

    if (!companyServices || companyServices.length !== validatedData.companyServiceIds.length) {
      return NextResponse.json({
        success: false,
        error: "Some company services not found or don't belong to your company",
        statusCode: 404
      } as ErrorResponse, { status: 404 })
    }

    // Check which services are already mapped to this warehouse
    const { data: existingMappings } = await supabase
      .from('warehouse_services')
      .select('company_service_id')
      .eq('warehouse_id', warehouseId)
      .in('company_service_id', validatedData.companyServiceIds)
      .not('company_service_id', 'is', null)

    const existingServiceIds = new Set(
      (existingMappings || []).map(m => m.company_service_id)
    )

    // Prepare warehouse services to insert
    const warehouseServicesToInsert = companyServices
      .filter(cs => !existingServiceIds.has(cs.id))
      .map(cs => ({
        warehouse_id: warehouseId,
        company_service_id: cs.id,
        service_name: cs.service_name,
        service_description: cs.service_description,
        pricing_type: cs.pricing_type,
        base_price: validatedData.overridePrices?.[cs.id] ?? cs.base_price,
        is_active: cs.is_active,
        status: true // Required for soft delete (migration 065)
      }))

    if (warehouseServicesToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All selected services are already mapped to this warehouse",
        data: { mapped: 0, alreadyMapped: validatedData.companyServiceIds.length }
      })
    }

    // Insert warehouse services
    const { data: insertedServices, error: insertError } = await supabase
      .from('warehouse_services')
      .insert(warehouseServicesToInsert)
      .select()

    if (insertError) {
      throw new Error(`Failed to map services to warehouse: ${insertError.message}`)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully mapped ${insertedServices.length} service(s) to warehouse`,
      data: {
        services: insertedServices,
        mapped: insertedServices.length,
        alreadyMapped: existingServiceIds.size
      }
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
      context: 'Failed to map services to warehouse'
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

