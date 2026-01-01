import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getWarehouseById, updateWarehouse, deleteWarehouse } from "@/lib/db/warehouses"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { generateWarehouseName } from "@/lib/utils/warehouse-name-generator"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/warehouses/[id]
 * Get warehouse by ID (public endpoint - no authentication required)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Public endpoint - no authentication required
    const { id } = await params
    const warehouse = await getWarehouseById(id)

    if (!warehouse) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Warehouse not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    const responseData = {
      success: true,
      data: warehouse,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: 'Failed to get warehouse' })
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
 * PATCH /api/v1/warehouses/[id]
 * Update warehouse
 */
export async function PATCH(
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

    const { id } = await params

    // Check if warehouse exists
    const existingWarehouse = await getWarehouseById(id)
    if (!existingWarehouse) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Warehouse not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check if user is company admin or owner of the warehouse
    const supabase = await createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .eq('status', true)
      .single()

    if (!profile || !profile.company_id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "User profile not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Get warehouse owner company
    const { data: warehouseData } = await supabase
      .from('warehouses')
      .select('owner_company_id')
      .eq('id', id)
      .eq('status', true)
      .single()

    if (!warehouseData) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Warehouse not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check access: root/admin can update any warehouse, company admin can only update their company's warehouses
    if (user.role !== 'root' && profile.company_id !== warehouseData.owner_company_id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Forbidden: You don't have permission to update this warehouse",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const body = await request.json()

    // Validate required fields
    const updates: any = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.address !== undefined) updates.address = body.address
    if (body.city !== undefined) updates.city = body.city
    if (body.state !== undefined) updates.state = body.state
    if (body.zipCode !== undefined) updates.zipCode = body.zipCode
    if (body.totalSqFt !== undefined) updates.totalSqFt = body.totalSqFt
    if (body.totalPalletStorage !== undefined) updates.totalPalletStorage = body.totalPalletStorage
    if (body.latitude !== undefined) updates.latitude = body.latitude
    if (body.longitude !== undefined) updates.longitude = body.longitude
    if (body.warehouseType !== undefined) updates.warehouseType = body.warehouseType
    if (body.storageType !== undefined) updates.storageType = body.storageType
    if (body.temperatureTypes !== undefined) updates.temperatureTypes = body.temperatureTypes
    if (body.amenities !== undefined) updates.amenities = body.amenities
    if (body.photos !== undefined) updates.photos = body.photos
    if (body.operatingHours !== undefined) updates.operatingHours = body.operatingHours
    if (body.customStatus !== undefined) updates.customStatus = body.customStatus
    if (body.minPallet !== undefined) updates.minPallet = body.minPallet
    if (body.maxPallet !== undefined) updates.maxPallet = body.maxPallet
    if (body.minSqFt !== undefined) updates.minSqFt = body.minSqFt
    if (body.maxSqFt !== undefined) updates.maxSqFt = body.maxSqFt
    if (body.rentMethods !== undefined) updates.rentMethods = body.rentMethods
    if (body.security !== undefined) updates.security = body.security
    if (body.videoUrl !== undefined) updates.videoUrl = body.videoUrl
    if (body.accessInfo !== undefined) updates.accessInfo = body.accessInfo
    if (body.productAcceptanceStartTime !== undefined) updates.productAcceptanceStartTime = body.productAcceptanceStartTime
    if (body.productAcceptanceEndTime !== undefined) updates.productAcceptanceEndTime = body.productAcceptanceEndTime
    if (body.workingDays !== undefined) updates.workingDays = body.workingDays

    // Regenerate warehouse name if city, state, or warehouseType changed
    const cityChanged = body.city !== undefined && body.city !== existingWarehouse.city
    const stateChanged = body.state !== undefined && body.state !== (existingWarehouse as any).state
    
    // Handle warehouseType comparison (can be string or array)
    const existingType = Array.isArray(existingWarehouse.warehouseType) 
      ? existingWarehouse.warehouseType[0] 
      : existingWarehouse.warehouseType
    const newType = Array.isArray(body.warehouseType) 
      ? body.warehouseType[0] 
      : body.warehouseType
    const typeChanged = body.warehouseType !== undefined && newType !== existingType

    if (cityChanged || stateChanged || typeChanged) {
      let newCity = body.city !== undefined ? body.city : existingWarehouse.city
      const newState = body.state !== undefined ? body.state : (existingWarehouse as any).state
      const newWarehouseType = body.warehouseType !== undefined 
        ? (Array.isArray(body.warehouseType) ? body.warehouseType[0] : body.warehouseType)
        : (Array.isArray(existingWarehouse.warehouseType) ? existingWarehouse.warehouseType[0] : existingWarehouse.warehouseType)

      // Extract city name if it's in "City, State" format
      if (newCity && newCity.includes(',')) {
        newCity = newCity.split(',')[0].trim()
      }

      // Generate new warehouse name based on updated city/state/type
      const newWarehouseName = generateWarehouseName(
        newCity,
        newWarehouseType || 'general',
        newState
      )
      updates.name = newWarehouseName
    }

    const updatedWarehouse = await updateWarehouse(id, updates)

    const responseData = {
      success: true,
      data: updatedWarehouse,
      message: "Warehouse updated successfully",
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: 'Failed to update warehouse' })
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
 * DELETE /api/v1/warehouses/[id]
 * Delete warehouse (soft delete)
 */
export async function DELETE(
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

    const { id } = await params

    // Check if warehouse exists
    const existingWarehouse = await getWarehouseById(id)
    if (!existingWarehouse) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Warehouse not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check if user is company admin or owner of the warehouse
    const supabase = await createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', user.id)
      .eq('status', true)
      .single()

    if (!profile || !profile.company_id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "User profile not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Get warehouse owner company
    const { data: warehouseData } = await supabase
      .from('warehouses')
      .select('owner_company_id')
      .eq('id', id)
      .eq('status', true)
      .single()

    if (!warehouseData) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Warehouse not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check access: root/admin can delete any warehouse, company admin can only delete their company's warehouses
    if (user.role !== 'root' && profile.company_id !== warehouseData.owner_company_id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Forbidden: You don't have permission to delete this warehouse",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    await deleteWarehouse(id)

    const responseData = {
      success: true,
      message: "Warehouse deleted successfully",
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: 'Failed to delete warehouse' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

