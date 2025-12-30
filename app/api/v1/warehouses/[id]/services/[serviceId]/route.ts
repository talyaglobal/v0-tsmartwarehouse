import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

// Validation schema for service update
const serviceUpdateSchema = z.object({
  serviceName: z.string().min(1).max(255).optional(),
  serviceDescription: z.string().optional(),
  pricingType: z.enum(['one_time', 'per_pallet', 'per_sqft', 'per_day', 'per_month']).optional(),
  basePrice: z.number().min(0).optional(),
  isActive: z.boolean().optional()
})

/**
 * PATCH /api/v1/warehouses/[id]/services/[serviceId]
 * Update a service (requires auth + ownership)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { id: warehouseId, serviceId } = await params
    const supabase = await createServerSupabaseClient()

    // Check ownership
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .eq('status', true)
      .single()

    if (!profile || profile.company_id !== warehouse.owner_company_id) {
      return NextResponse.json({
        success: false,
        error: "You don't have permission to manage this service",
        statusCode: 403
      } as ErrorResponse, { status: 403 })
    }

    // Validate request body
    const body = await request.json()
    const validatedData = serviceUpdateSchema.parse(body)

    // Build update object
    const updateData: any = {}
    if (validatedData.serviceName !== undefined) updateData.service_name = validatedData.serviceName
    if (validatedData.serviceDescription !== undefined) updateData.service_description = validatedData.serviceDescription
    if (validatedData.pricingType !== undefined) updateData.pricing_type = validatedData.pricingType
    if (validatedData.basePrice !== undefined) updateData.base_price = validatedData.basePrice
    if (validatedData.isActive !== undefined) updateData.is_active = validatedData.isActive

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: false,
        error: "No fields to update",
        statusCode: 400
      } as ErrorResponse, { status: 400 })
    }

    // Update service
    const { data: service, error } = await supabase
      .from('warehouse_services')
      .update(updateData)
      .eq('id', serviceId)
      .eq('warehouse_id', warehouseId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update service: ${error.message}`)
    }

    if (!service) {
      return NextResponse.json({
        success: false,
        error: "Service not found",
        statusCode: 404
      } as ErrorResponse, { status: 404 })
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
      context: 'Failed to update warehouse service'
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
 * DELETE /api/v1/warehouses/[id]/services/[serviceId]
 * Delete a service (requires auth + ownership)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; serviceId: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { id: warehouseId, serviceId } = await params
    const supabase = await createServerSupabaseClient()

    // Check ownership
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .eq('status', true)
      .single()

    if (!profile || profile.company_id !== warehouse.owner_company_id) {
      return NextResponse.json({
        success: false,
        error: "You don't have permission to delete this service",
        statusCode: 403
      } as ErrorResponse, { status: 403 })
    }

    // Check if service is used in any active bookings
    const { data: bookingServices, error: checkError } = await supabase
      .from('booking_services')
      .select('id')
      .eq('service_id', serviceId)
      .limit(1)

    if (checkError) {
      throw new Error(`Failed to check service usage: ${checkError.message}`)
    }

    if (bookingServices && bookingServices.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Cannot delete service that has been used in bookings. You can deactivate it instead.",
        statusCode: 400
      } as ErrorResponse, { status: 400 })
    }

    // Delete service
    const { error } = await supabase
      .from('warehouse_services')
      .delete()
      .eq('id', serviceId)
      .eq('warehouse_id', warehouseId)

    if (error) {
      throw new Error(`Failed to delete service: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "Service deleted successfully"
      }
    })
  } catch (error) {
    const errorResponse = handleApiError(error, {
      context: 'Failed to delete warehouse service'
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
