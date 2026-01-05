import { NextRequest, NextResponse } from "next/server"
import { getWarehouseById as getWarehouseByIdFromDb } from "@/lib/db/warehouses"
import { updateWarehouse } from "@/lib/db/warehouses"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { z } from "zod"
import type { ErrorResponse, ApiResponse } from "@/types/api"

const updateWarehouseSchema = z.object({
  address: z.string().min(1, "Address is required").optional(),
  city: z.string().min(1, "City is required").optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  totalSqFt: z.number().positive("Total square feet must be positive").optional(),
  totalPalletStorage: z.number().positive("Total pallet storage must be positive").optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  warehouseType: z.string().min(1, "Warehouse type is required").optional(),
  storageType: z.string().min(1, "Storage type is required").optional(),
  temperatureTypes: z.array(z.enum(["ambient-with-ac", "ambient-without-ac", "ambient-with-heater", "ambient-without-heater", "chilled", "frozen", "open-area-with-tent", "open-area"])).min(1, "At least one temperature option is required").optional(),
  amenities: z.array(z.string()).optional(),
  photos: z.array(z.string()).min(2, "At least 2 warehouse photos are required").optional(),
  operatingHours: z.object({
    open: z.string(),
    close: z.string(),
    days: z.array(z.string()),
  }).optional(),
  customStatus: z.enum(["antrepolu", "regular"]).optional(),
  minPallet: z.number().int().positive().optional(),
  maxPallet: z.number().int().positive().optional(),
  minSqFt: z.number().int().positive().optional(),
  maxSqFt: z.number().int().positive().optional(),
  rentMethods: z.array(z.enum(["pallet", "sq_ft"])).optional(),
  security: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  accessInfo: z.object({
    accessType: z.string().optional(),
    appointmentRequired: z.boolean().optional(),
    accessControl: z.string().optional(),
  }).optional(),
  productAcceptanceStartTime: z.string().optional(),
  productAcceptanceEndTime: z.string().optional(),
  workingDays: z.array(z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])).optional(),
  warehouseInFee: z.number().nonnegative().optional(),
  warehouseOutFee: z.number().nonnegative().optional(),
  ports: z.array(z.object({
    name: z.string().min(1, "Port name is required"),
    container40DC: z.number().nonnegative().optional(),
    container40HC: z.number().nonnegative().optional(),
    container20DC: z.number().nonnegative().optional(),
  })).optional(),
  pricing: z.array(z.object({
    pricing_type: z.enum(["pallet", "pallet-monthly", "area", "area-rental"]),
    base_price: z.number().positive(),
    unit: z.string(),
    min_quantity: z.number().int().nonnegative().nullable().optional(),
    max_quantity: z.number().int().nonnegative().nullable().optional(),
    volume_discounts: z.record(z.string(), z.number()).nullable().optional(),
  })).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const warehouseId = resolvedParams.id

    if (!warehouseId) {
      return NextResponse.json(
        { success: false, error: "Warehouse ID is required" },
        { status: 400 }
      )
    }

    const warehouse = await getWarehouseByIdFromDb(warehouseId)

    if (!warehouse) {
      return NextResponse.json(
        { success: false, error: "Warehouse not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: warehouse,
    })
  } catch (error) {
    console.error("Error fetching warehouse:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const resolvedParams = params instanceof Promise ? await params : params
    const warehouseId = resolvedParams.id

    if (!warehouseId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Warehouse ID is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Check if user is company admin
    if (user.role !== 'root') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (!userCompanyId) {
        const errorData: ErrorResponse = {
          success: false,
          error: "User must belong to a company",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }

      // Check if user owns this warehouse
      const warehouse = await getWarehouseByIdFromDb(warehouseId)
      if (!warehouse) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Warehouse not found",
          statusCode: 404,
        }
        return NextResponse.json(errorData, { status: 404 })
      }

      if ((warehouse as any).ownerCompanyId !== userCompanyId) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: You can only update your own company's warehouses",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }

      const isAdmin = await isCompanyAdmin(user.id, userCompanyId)
      if (!isAdmin) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: Only company admins can update warehouses",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    }

    const body = await request.json()

    // Validate input
    const validated = updateWarehouseSchema.parse(body)

    // Prepare update data
    const updateData: any = {}
    if (validated.address !== undefined) updateData.address = validated.address
    if (validated.city !== undefined) updateData.city = validated.city
    if (validated.zipCode !== undefined) updateData.zipCode = validated.zipCode
    if (validated.totalSqFt !== undefined) updateData.totalSqFt = validated.totalSqFt
    if (validated.totalPalletStorage !== undefined) updateData.totalPalletStorage = validated.totalPalletStorage
    if (validated.latitude !== undefined) updateData.latitude = validated.latitude
    if (validated.longitude !== undefined) updateData.longitude = validated.longitude
    if (validated.warehouseType !== undefined) updateData.warehouseType = validated.warehouseType
    if (validated.storageType !== undefined) updateData.storageType = validated.storageType
    if (validated.temperatureTypes !== undefined) updateData.temperatureTypes = validated.temperatureTypes
    if (validated.amenities !== undefined) updateData.amenities = validated.amenities
    if (validated.photos !== undefined) updateData.photos = validated.photos
    if (validated.operatingHours !== undefined) updateData.operatingHours = validated.operatingHours
    if (validated.customStatus !== undefined) updateData.customStatus = validated.customStatus
    if (validated.minPallet !== undefined) updateData.minPallet = validated.minPallet
    if (validated.maxPallet !== undefined) updateData.maxPallet = validated.maxPallet
    if (validated.minSqFt !== undefined) updateData.minSqFt = validated.minSqFt
    if (validated.maxSqFt !== undefined) updateData.maxSqFt = validated.maxSqFt
    if (validated.rentMethods !== undefined) updateData.rentMethods = validated.rentMethods
    if (validated.security !== undefined) updateData.security = validated.security
    if (validated.videoUrl !== undefined) updateData.videoUrl = validated.videoUrl
    if (validated.accessInfo !== undefined) updateData.accessInfo = validated.accessInfo
    if (validated.productAcceptanceStartTime !== undefined) updateData.productAcceptanceStartTime = validated.productAcceptanceStartTime
    if (validated.productAcceptanceEndTime !== undefined) updateData.productAcceptanceEndTime = validated.productAcceptanceEndTime
    if (validated.workingDays !== undefined) updateData.workingDays = validated.workingDays
    if (validated.warehouseInFee !== undefined) updateData.warehouseInFee = validated.warehouseInFee
    if (validated.warehouseOutFee !== undefined) updateData.warehouseOutFee = validated.warehouseOutFee
    if (validated.ports !== undefined) updateData.ports = validated.ports
    if (validated.state !== undefined) updateData.state = validated.state

    // Update warehouse
    const updatedWarehouse = await updateWarehouse(warehouseId, updateData)

    // Update pricing entries if provided
    if (validated.pricing && validated.pricing.length > 0) {
      const supabase = createServerSupabaseClient()
      
      // Delete existing pricing for this warehouse
      await supabase
        .from('warehouse_pricing')
        .delete()
        .eq('warehouse_id', warehouseId)

      // Insert new pricing entries
      for (const price of validated.pricing) {
        await supabase.from('warehouse_pricing').insert({
          warehouse_id: warehouseId,
          pricing_type: price.pricing_type,
          base_price: price.base_price,
          unit: price.unit,
          min_quantity: price.min_quantity,
          max_quantity: price.max_quantity,
          volume_discounts: price.volume_discounts,
          status: true,
        })
      }
    }

    const responseData: ApiResponse = {
      success: true,
      data: updatedWarehouse,
      message: "Warehouse updated successfully",
    }
    return NextResponse.json(responseData, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Validation error",
        statusCode: 400,
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const errorResponse = handleApiError(error, { path: `/api/v1/warehouses/${(await params).id}`, method: "PUT" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
