import { NextRequest, NextResponse } from "next/server"
import { getWarehouseById as getWarehouseByIdFromDb } from "@/lib/db/warehouses"
import { updateWarehouse } from "@/lib/db/warehouses"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateWarehouseName } from "@/lib/utils/warehouse-name-generator"
import { z } from "zod"

const freeStorageRuleSchema = z.object({
  minDuration: z.number().positive(),
  maxDuration: z.number().positive().optional(),
  durationUnit: z.enum(["day", "week", "month"]),
  freeAmount: z.number().nonnegative(),
  freeUnit: z.enum(["day", "week", "month"]),
}).refine(
  (rule) => rule.maxDuration === undefined || rule.maxDuration >= rule.minDuration,
  { message: "Max duration must be greater than or equal to min duration" }
)

const floorZoneSchema = z.object({
  zoneType: z.string().min(1),
  xM: z.number().nonnegative(),
  yM: z.number().nonnegative(),
  widthM: z.number().positive(),
  heightM: z.number().positive(),
  rotationDeg: z.number().optional(),
})

const floorPlanSchema = z.object({
  name: z.string().min(1),
  floorLevel: z.number().int(),
  lengthM: z.number().positive(),
  widthM: z.number().positive(),
  heightM: z.number().positive(),
  wallClearanceM: z.number().nonnegative(),
  sprinklerClearanceM: z.number().nonnegative(),
  safetyClearanceM: z.number().nonnegative(),
  mainAisleM: z.number().nonnegative(),
  sideAisleM: z.number().nonnegative(),
  pedestrianAisleM: z.number().nonnegative(),
  loadingZoneDepthM: z.number().nonnegative(),
  dockZoneDepthM: z.number().nonnegative(),
  standardPalletHeightM: z.number().positive(),
  euroPalletHeightM: z.number().positive(),
  customPalletLengthCm: z.number().positive(),
  customPalletWidthCm: z.number().positive(),
  customPalletHeightCm: z.number().positive(),
  stackingOverride: z.number().int().positive().nullable().optional(),
  zones: z.array(floorZoneSchema),
})
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
  warehouseType: z.array(z.string()).min(1, "At least one warehouse type is required").optional(), // Changed to array
  storageType: z.array(z.string()).min(1, "At least one storage type is required").optional(), // Changed to array
  temperatureTypes: z.array(z.enum(["ambient-with-ac", "ambient-without-ac", "ambient-with-heater", "ambient-without-heater", "chilled", "frozen", "open-area-with-tent", "open-area"])).min(1, "At least one temperature option is required").optional(),
  amenities: z.array(z.string()).optional(),
  description: z.string().optional(),
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
  videos: z.array(z.string()).optional(), // Changed from videoUrl to videos array
  accessInfo: z.object({
    accessType: z.string().optional(),
    appointmentRequired: z.boolean().optional(),
    accessControl: z.string().optional(),
  }).optional(),
  productAcceptanceTimeSlots: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })).optional(), // Changed from single times to time slots array
  productDepartureTimeSlots: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })).optional(), // New field
  overtimePrice: z.object({
    afterRegularWorkTime: z.object({
      in: z.number().nonnegative().optional(),
      out: z.number().nonnegative().optional(),
    }).optional(),
    holidays: z.object({
      in: z.number().nonnegative().optional(),
      out: z.number().nonnegative().optional(),
    }).optional(),
  }).optional(), // New field - object with per-pallet in/out pricing
  palletPricing: z.array(z.object({
    goodsType: z.string().min(1).optional(),
    palletType: z.enum(["euro", "standard", "custom"]),
    pricingPeriod: z.enum(["day", "week", "month"]),
    stackable: z.boolean().optional(), // Stackable or unstackable option
    stackableAdjustmentType: z.enum(["rate", "plus_per_unit"]).optional(),
    stackableAdjustmentValue: z.number().nonnegative().optional(),
    unstackableAdjustmentType: z.enum(["rate", "plus_per_unit"]).optional(),
    unstackableAdjustmentValue: z.number().nonnegative().optional(),
    customDimensions: z.object({
      length: z.number().nonnegative(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative(),
      unit: z.enum(["cm", "in"]).optional(),
    }).optional(),
    customSizes: z.array(z.object({
      lengthMin: z.number().positive(),
      lengthMax: z.number().positive(),
      widthMin: z.number().positive(),
      widthMax: z.number().positive(),
      stackableAdjustmentType: z.enum(["rate", "plus_per_unit"]).optional(),
      stackableAdjustmentValue: z.number().nonnegative().optional(),
      unstackableAdjustmentType: z.enum(["rate", "plus_per_unit"]).optional(),
      unstackableAdjustmentValue: z.number().nonnegative().optional(),
      heightRanges: z.array(z.object({
        heightMinCm: z.number().nonnegative(),
        heightMaxCm: z.number().positive().optional(), // Optional for last range (infinity)
        pricePerUnit: z.number().positive(),
        unstackableMethod: z.enum(["rate", "plus_per_unit"]).optional(),
        unstackableValue: z.number().nonnegative().optional(),
      })),
    })).optional(),
    heightRanges: z.array(z.object({
      heightMinCm: z.number().nonnegative(),
      heightMaxCm: z.number().positive().optional(), // Optional for last range (infinity)
      pricePerUnit: z.number().positive(),
      unstackableMethod: z.enum(["rate", "plus_per_unit"]).optional(),
      unstackableValue: z.number().nonnegative().optional(),
    })).optional(),
    weightRanges: z.array(z.object({
      weightMinKg: z.number().nonnegative(),
      weightMaxKg: z.number().positive().optional(), // Optional for last range (infinity)
      pricePerPallet: z.number().positive(),
      unstackableMethod: z.enum(["rate", "plus_per_unit"]).optional(),
      unstackableValue: z.number().nonnegative().optional(),
    })).optional(),
  })).optional(), // New field
  workingDays: z.array(z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])).optional(),
  warehouseInFee: z.number().nonnegative().optional(),
  warehouseOutFee: z.number().nonnegative().optional(),
  ports: z.array(z.object({
    name: z.string().min(1, "Port name is required"),
    container40DC: z.number().nonnegative().optional(),
    container40HC: z.number().nonnegative().optional(),
    container20DC: z.number().nonnegative().optional(),
  })).optional(),
  freeStorageRules: z.array(freeStorageRuleSchema).optional(),
  floorPlans: z.array(floorPlanSchema).optional(),
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

    // Debug: Log palletPricing data
    console.log('[GET API] palletPricing count:', (warehouse as any).palletPricing?.length || 0)
    if ((warehouse as any).palletPricing?.length > 0) {
      const firstEntry = (warehouse as any).palletPricing[0]
      console.log('[GET API] First entry:', {
        palletType: firstEntry.palletType,
        pricingPeriod: firstEntry.pricingPeriod,
        goodsType: firstEntry.goodsType,
        heightRangesCount: firstEntry.heightRanges?.length || 0,
        weightRangesCount: firstEntry.weightRanges?.length || 0,
      })
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

    const resolvedParams = params instanceof Promise ? await params : params
    const warehouseId = resolvedParams.id

    if (!warehouseId) {
      return NextResponse.json(
        { success: false, error: "Warehouse ID is required" },
        { status: 400 }
      )
    }

    // Check authorization
    const warehouse = await getWarehouseByIdFromDb(warehouseId)
    if (!warehouse) {
      return NextResponse.json(
        { success: false, error: "Warehouse not found" },
        { status: 404 }
      )
    }

    if (user.role !== 'root') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (!userCompanyId || (warehouse as any).ownerCompanyId !== userCompanyId) {
        return NextResponse.json(
          { success: false, error: "Forbidden: You can only update your own company's warehouses" },
          { status: 403 }
        )
      }

      const isAdmin = await isCompanyAdmin(user.id, userCompanyId)
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Only company admins can update warehouses" },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const supabase = createAdminClient()

    // Build update object with only provided fields
    const updateFields: Record<string, any> = {}
    
    if (body.name !== undefined) updateFields.name = body.name
    if (body.address !== undefined) updateFields.address = body.address
    if (body.city !== undefined) updateFields.city = body.city
    if (body.country !== undefined) updateFields.country = body.country
    if (body.zip_code !== undefined) updateFields.zip_code = body.zip_code
    if (body.total_sq_ft !== undefined) updateFields.total_sq_ft = body.total_sq_ft
    if (body.total_pallet_storage !== undefined) updateFields.total_pallet_storage = body.total_pallet_storage
    if (body.available_sq_ft !== undefined) updateFields.available_sq_ft = body.available_sq_ft
    if (body.available_pallet_storage !== undefined) updateFields.available_pallet_storage = body.available_pallet_storage
    if (body.status !== undefined) updateFields.status = body.status
    if (body.latitude !== undefined) updateFields.latitude = body.latitude
    if (body.longitude !== undefined) updateFields.longitude = body.longitude
    
    updateFields.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('warehouses')
      .update(updateFields)
      .eq('id', warehouseId)
      .select()
      .single()

    if (error) {
      console.error('Error updating warehouse:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update warehouse', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Warehouse updated successfully',
    })
  } catch (error) {
    console.error("Error updating warehouse:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
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

    // Debug: Log overtimePrice before validation
    if (body.overtimePrice) {
      console.log('[EDIT API] OvertimePrice received:', JSON.stringify(body.overtimePrice, null, 2))
    }

    // Validate input
    const validated = updateWarehouseSchema.parse(body)
    
    // Debug: Log overtimePrice after validation
    if (validated.overtimePrice) {
      console.log('[EDIT API] OvertimePrice validated:', JSON.stringify(validated.overtimePrice, null, 2))
    }

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
    if (validated.description !== undefined) updateData.description = validated.description
    if (validated.photos !== undefined) updateData.photos = validated.photos
    if (validated.operatingHours !== undefined) updateData.operatingHours = validated.operatingHours
    if (validated.customStatus !== undefined) updateData.customStatus = validated.customStatus
    if (validated.minPallet !== undefined) updateData.minPallet = validated.minPallet
    if (validated.maxPallet !== undefined) updateData.maxPallet = validated.maxPallet
    if (validated.minSqFt !== undefined) updateData.minSqFt = validated.minSqFt
    if (validated.maxSqFt !== undefined) updateData.maxSqFt = validated.maxSqFt
    if (validated.rentMethods !== undefined) updateData.rentMethods = validated.rentMethods
    if (validated.freeStorageRules !== undefined) updateData.freeStorageRules = validated.freeStorageRules
    if (validated.security !== undefined) updateData.security = validated.security
    if (validated.videos !== undefined) updateData.videos = validated.videos // Changed from videoUrl to videos
    if (validated.accessInfo !== undefined) updateData.accessInfo = validated.accessInfo
    if (validated.productAcceptanceTimeSlots !== undefined) updateData.productAcceptanceTimeSlots = validated.productAcceptanceTimeSlots // Changed from single times to time slots array
    if (validated.productDepartureTimeSlots !== undefined) updateData.productDepartureTimeSlots = validated.productDepartureTimeSlots // New field
    if (validated.workingDays !== undefined) updateData.workingDays = validated.workingDays
    if (validated.warehouseInFee !== undefined) updateData.warehouseInFee = validated.warehouseInFee
    if (validated.warehouseOutFee !== undefined) updateData.warehouseOutFee = validated.warehouseOutFee
    if (validated.overtimePrice !== undefined) {
      // If overtimePrice is provided, check if it has any values
      if (validated.overtimePrice && 
          (validated.overtimePrice.afterRegularWorkTime?.in !== undefined || 
           validated.overtimePrice.afterRegularWorkTime?.out !== undefined || 
           validated.overtimePrice.holidays?.in !== undefined ||
           validated.overtimePrice.holidays?.out !== undefined)) {
        updateData.overtimePrice = validated.overtimePrice // New field
        console.log('[EDIT API] OvertimePrice set in updateData:', JSON.stringify(updateData.overtimePrice, null, 2))
      } else {
        // If empty object or all undefined, set to null
        updateData.overtimePrice = null
      }
    } else {
    }
    if (validated.ports !== undefined) updateData.ports = validated.ports
    if (validated.state !== undefined) updateData.state = validated.state

    // Regenerate warehouse name if city, warehouseType, or state is updated
    if (validated.city !== undefined || validated.warehouseType !== undefined || validated.state !== undefined) {
      // Get existing warehouse data for fields that aren't being updated
      const existingWarehouse = await getWarehouseByIdFromDb(warehouseId)
      
      const city = validated.city ?? existingWarehouse?.city ?? ''
      const state = validated.state ?? (existingWarehouse as any)?.state ?? ''
      const warehouseType = validated.warehouseType ?? (existingWarehouse as any)?.warehouseType ?? ['general']
      
      // Generate new name based on updated values
      const newName = generateWarehouseName(
        city,
        Array.isArray(warehouseType) ? warehouseType[0] : warehouseType || 'general',
        state
      )
      updateData.name = newName
      console.log('[EDIT API] Regenerated warehouse name:', newName)
    }

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

    // Update pallet pricing entries if provided
    // If palletPricing is undefined, don't touch existing records
    // If palletPricing is an empty array, delete all existing records
    // If palletPricing has entries, replace all existing records
    console.log('[EDIT API] palletPricing received:', validated.palletPricing ? `${validated.palletPricing.length} entries` : 'undefined')
    
    if (validated.palletPricing !== undefined) {
      console.log('[EDIT API] Processing pallet pricing update...')
      const supabase = createServerSupabaseClient()
      
      // Get existing pallet pricing IDs to delete related records
      const { data: existingPalletPricing, error: fetchError } = await supabase
        .from('warehouse_pallet_pricing')
        .select('id')
        .eq('warehouse_id', warehouseId)
      
      console.log('[EDIT API] Existing pallet pricing:', existingPalletPricing?.length || 0, 'records, fetchError:', fetchError?.message)

      if (existingPalletPricing && existingPalletPricing.length > 0) {
        const palletPricingIds = existingPalletPricing.map(p => p.id)
        console.log('[EDIT API] Deleting existing pallet pricing IDs:', palletPricingIds)
        
        // Delete custom pallet size height pricing first
        const { error: customSizeHeightDeleteError } = await supabase
          .from('warehouse_custom_pallet_size_height_pricing')
          .delete()
          .in('custom_pallet_size_id', 
            (await supabase
              .from('warehouse_custom_pallet_sizes')
              .select('id')
              .in('pallet_pricing_id', palletPricingIds)
            ).data?.map((s: any) => s.id) || []
          )
        
        // Delete custom pallet sizes
        const { error: customSizeDeleteError } = await supabase
          .from('warehouse_custom_pallet_sizes')
          .delete()
          .in('pallet_pricing_id', palletPricingIds)
        
        // Delete height and weight pricing
        const { error: heightDeleteError } = await supabase
          .from('warehouse_pallet_height_pricing')
          .delete()
          .in('pallet_pricing_id', palletPricingIds)
        
        const { error: weightDeleteError } = await supabase
          .from('warehouse_pallet_weight_pricing')
          .delete()
          .in('pallet_pricing_id', palletPricingIds)
        
        // Delete base pallet pricing
        const { error: baseDeleteError } = await supabase
          .from('warehouse_pallet_pricing')
          .delete()
          .eq('warehouse_id', warehouseId)
        
        console.log('[EDIT API] Delete results:', {
          customSizeHeightDeleteError: customSizeHeightDeleteError?.message,
          customSizeDeleteError: customSizeDeleteError?.message,
          heightDeleteError: heightDeleteError?.message,
          weightDeleteError: weightDeleteError?.message,
          baseDeleteError: baseDeleteError?.message,
        })
      }

      // Only insert new records if array is not empty
      if (validated.palletPricing.length > 0) {
        // For custom pallet type, find customDimensions from any period (they should be the same across all periods)
        // Try to find from day period first, then any period
        const customPalletPricingDay = validated.palletPricing.find(p => p.palletType === 'custom' && p.pricingPeriod === 'day')
        const customPalletPricing = customPalletPricingDay || validated.palletPricing.find(p => p.palletType === 'custom')
        const customDimensions = customPalletPricing?.customDimensions || null
        
        console.log(`[DEBUG] Custom pallet dimensions found:`, {
          customPalletPricingDay: customPalletPricingDay?.customDimensions,
          customPalletPricing: customPalletPricing?.customDimensions,
          customDimensions: customDimensions,
        })
        
        // Insert new pallet pricing entries
        for (const palletPrice of validated.palletPricing) {
          const goodsType = (palletPrice.goodsType || 'general').trim().toLowerCase()
          // Insert base pallet pricing record
          // For custom pallet type, use customDimensions from any period (they should be the same)
          const dimensionsToUse = palletPrice.palletType === 'custom' 
            ? (palletPrice.customDimensions || customDimensions)
            : null
          
          console.log(`[DEBUG] Pallet pricing for ${palletPrice.palletType} ${palletPrice.pricingPeriod}:`, {
            hasCustomDimensions: !!palletPrice.customDimensions,
            customDimensions: palletPrice.customDimensions,
            dimensionsToUse: dimensionsToUse,
          })
          
          const { data: palletPricingRecord, error: palletError } = await supabase
            .from('warehouse_pallet_pricing')
            .insert({
              warehouse_id: warehouseId,
              pallet_type: palletPrice.palletType,
              pricing_period: palletPrice.pricingPeriod,
              goods_type: goodsType,
              stackable: palletPrice.stackable !== undefined ? palletPrice.stackable : true, // Default to true if not specified
              stackable_adjustment_type: palletPrice.stackableAdjustmentType || 'plus_per_unit',
              stackable_adjustment_value: palletPrice.stackableAdjustmentValue ?? 0,
              unstackable_adjustment_type: palletPrice.unstackableAdjustmentType || 'plus_per_unit',
              unstackable_adjustment_value: palletPrice.unstackableAdjustmentValue ?? 0,
              custom_length_cm: dimensionsToUse?.length !== undefined && dimensionsToUse.length !== null && dimensionsToUse.length > 0 ? dimensionsToUse.length : null,
              custom_width_cm: dimensionsToUse?.width !== undefined && dimensionsToUse.width !== null && dimensionsToUse.width > 0 ? dimensionsToUse.width : null,
              custom_height_cm: dimensionsToUse?.height !== undefined && dimensionsToUse.height !== null && dimensionsToUse.height > 0 ? dimensionsToUse.height : null,
              status: true,
            })
            .select()
            .single()

          if (palletError || !palletPricingRecord) {
            console.error('Error creating pallet pricing:', palletError)
            continue
          }

          // Log custom sizes for debugging
          if (palletPrice.palletType === 'custom') {
            console.log(`[EDIT API] Custom pallet ${palletPrice.pricingPeriod} - customSizes:`, 
              palletPrice.customSizes ? `${palletPrice.customSizes.length} sizes` : 'undefined',
              palletPrice.customSizes?.[0] ? {
                lengthMin: palletPrice.customSizes[0].lengthMin,
                lengthMax: palletPrice.customSizes[0].lengthMax,
                heightRangesCount: palletPrice.customSizes[0].heightRanges?.length || 0
              } : 'no size data')
          }

          if (palletPrice.palletType === 'custom' && palletPrice.customSizes && palletPrice.customSizes.length > 0) {
            const { data: sizeRows, error: sizeError } = await supabase
              .from('warehouse_custom_pallet_sizes')
              .insert(
                palletPrice.customSizes.map((size) => ({
                  pallet_pricing_id: palletPricingRecord.id,
                  length_cm: size.lengthMin,
                  width_cm: size.widthMin,
                  length_min_cm: size.lengthMin,
                  length_max_cm: size.lengthMax,
                  width_min_cm: size.widthMin,
                  width_max_cm: size.widthMax,
                  stackable_adjustment_type: size.stackableAdjustmentType || 'plus_per_unit',
                  stackable_adjustment_value: size.stackableAdjustmentValue ?? 0,
                  unstackable_adjustment_type: size.unstackableAdjustmentType || 'plus_per_unit',
                  unstackable_adjustment_value: size.unstackableAdjustmentValue ?? 0,
                  status: true,
                }))
              )
              .select('id')

            if (sizeError || !sizeRows) {
              console.error('Error creating custom pallet sizes:', sizeError)
            } else {
              const heightRows = sizeRows.flatMap((sizeRow, index) => {
                const size = palletPrice.customSizes?.[index]
                if (!size || !size.heightRanges || size.heightRanges.length === 0) return []
                return size.heightRanges.map((range) => ({
                  custom_pallet_size_id: sizeRow.id,
                  height_min_cm: range.heightMinCm,
                  height_max_cm: range.heightMaxCm,
                  price_per_unit: range.pricePerUnit,
                  unstackable_method: range.unstackableMethod || 'rate',
                  unstackable_value: range.unstackableValue ?? 0,
                  status: true,
                }))
              })
              if (heightRows.length > 0) {
                console.log(`[EDIT API] Inserting ${heightRows.length} custom size height ranges`)
                const { error: customHeightError } = await supabase.from('warehouse_custom_pallet_size_height_pricing').insert(heightRows)
                if (customHeightError) {
                  console.error('[EDIT API] Error inserting custom size height pricing:', customHeightError.message)
                } else {
                  console.log(`[EDIT API] Successfully inserted custom size height pricing`)
                }
              } else {
                console.log(`[EDIT API] No custom size height ranges to insert`)
              }
            }
          }

          // Insert height range pricing
          if (palletPrice.heightRanges && palletPrice.heightRanges.length > 0) {
            console.log(`[EDIT API] Inserting ${palletPrice.heightRanges.length} height ranges for ${palletPrice.palletType} ${palletPrice.pricingPeriod}`)
            const heightData = palletPrice.heightRanges.map(range => ({
              pallet_pricing_id: palletPricingRecord.id,
              height_min_cm: range.heightMinCm,
              height_max_cm: range.heightMaxCm !== undefined ? range.heightMaxCm : null,
              price_per_unit: range.pricePerUnit,
              unstackable_method: range.unstackableMethod || 'rate',
              unstackable_value: range.unstackableValue ?? 0,
              status: true,
            }))
            console.log('[EDIT API] Height data sample:', JSON.stringify(heightData[0]))
            const { error: heightError } = await supabase.from('warehouse_pallet_height_pricing').insert(heightData)
            if (heightError) {
              console.error('[EDIT API] Error inserting height pricing:', heightError.message, heightError.details, heightError.hint)
            }
          } else {
            console.log(`[EDIT API] No height ranges for ${palletPrice.palletType} ${palletPrice.pricingPeriod}`)
          }

          // Insert weight range pricing
          if (palletPrice.weightRanges && palletPrice.weightRanges.length > 0) {
            console.log(`[EDIT API] Inserting ${palletPrice.weightRanges.length} weight ranges for ${palletPrice.palletType} ${palletPrice.pricingPeriod}`)
            const weightData = palletPrice.weightRanges.map(range => ({
              pallet_pricing_id: palletPricingRecord.id,
              weight_min_kg: range.weightMinKg,
              weight_max_kg: range.weightMaxKg !== undefined ? range.weightMaxKg : null,
              price_per_pallet: range.pricePerPallet,
              unstackable_method: range.unstackableMethod || 'rate',
              unstackable_value: range.unstackableValue ?? 0,
              status: true,
            }))
            const { error: weightError } = await supabase.from('warehouse_pallet_weight_pricing').insert(weightData)
            if (weightError) {
              console.error('[EDIT API] Error inserting weight pricing:', weightError.message, weightError.details, weightError.hint)
            }
          } else {
            console.log(`[EDIT API] No weight ranges for ${palletPrice.palletType} ${palletPrice.pricingPeriod}`)
          }
        }
      }
    }

    if (validated.floorPlans) {
      const supabaseFloors = createServerSupabaseClient()
      const { data: existingFloors } = await supabaseFloors
        .from('warehouse_floors')
        .select('id')
        .eq('warehouse_id', warehouseId)

      const floorIds = (existingFloors || []).map((floor) => floor.id)
      if (floorIds.length > 0) {
        await supabaseFloors.from('warehouse_floor_zones').delete().in('floor_id', floorIds)
        await supabaseFloors.from('warehouse_floor_aisle_defs').delete().in('floor_id', floorIds)
        await supabaseFloors.from('warehouse_floor_pallet_layouts').delete().in('floor_id', floorIds)
        await supabaseFloors.from('warehouse_floors').delete().in('id', floorIds)
      }

      if (validated.floorPlans.length > 0) {
        const { data: floorRows, error: floorError } = await supabaseFloors
          .from('warehouse_floors')
          .insert(
            validated.floorPlans.map((floor) => ({
              warehouse_id: warehouseId,
              name: floor.name,
              floor_level: floor.floorLevel,
              length_m: floor.lengthM,
              width_m: floor.widthM,
              height_m: floor.heightM,
              wall_clearance_m: floor.wallClearanceM,
              sprinkler_clearance_m: floor.sprinklerClearanceM,
              safety_clearance_m: floor.safetyClearanceM,
              main_aisle_m: floor.mainAisleM,
              side_aisle_m: floor.sideAisleM,
              pedestrian_aisle_m: floor.pedestrianAisleM,
              loading_zone_depth_m: floor.loadingZoneDepthM,
              dock_zone_depth_m: floor.dockZoneDepthM,
              standard_pallet_height_m: floor.standardPalletHeightM,
              euro_pallet_height_m: floor.euroPalletHeightM,
              custom_pallet_length_cm: floor.customPalletLengthCm,
              custom_pallet_width_cm: floor.customPalletWidthCm,
              custom_pallet_height_cm: floor.customPalletHeightCm,
              stacking_override: floor.stackingOverride ?? null,
              status: true,
            }))
          )
          .select('id')

        if (floorError || !floorRows) {
          console.error('Error creating floor plans:', floorError)
        } else {
          const zoneRows = floorRows.flatMap((floorRow, index) => {
            const floor = validated.floorPlans?.[index]
            if (!floor || !floor.zones || floor.zones.length === 0) return []
            return floor.zones.map((zone) => ({
              floor_id: floorRow.id,
              zone_type: zone.zoneType,
              x_m: zone.xM,
              y_m: zone.yM,
              width_m: zone.widthM,
              height_m: zone.heightM,
              rotation_deg: zone.rotationDeg ?? 0,
              status: true,
            }))
          })
          if (zoneRows.length > 0) {
            await supabaseFloors.from('warehouse_floor_zones').insert(zoneRows)
          }

          const aisleRows = floorRows.flatMap((floorRow, index) => {
            const floor = validated.floorPlans?.[index]
            if (!floor) return []
            return [
              { floor_id: floorRow.id, aisle_type: 'main', width_m: floor.mainAisleM, status: true },
              { floor_id: floorRow.id, aisle_type: 'side', width_m: floor.sideAisleM, status: true },
              { floor_id: floorRow.id, aisle_type: 'pedestrian', width_m: floor.pedestrianAisleM, status: true },
            ]
          })
          if (aisleRows.length > 0) {
            await supabaseFloors.from('warehouse_floor_aisle_defs').insert(aisleRows)
          }
        }
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

    const resolvedParams = params instanceof Promise ? await params : params
    const warehouseId = resolvedParams.id

    if (!warehouseId) {
      return NextResponse.json(
        { success: false, error: "Warehouse ID is required" },
        { status: 400 }
      )
    }

    // Only root users can delete warehouses from admin panel
    // Or company admins can delete their own warehouses
    const warehouse = await getWarehouseByIdFromDb(warehouseId)
    if (!warehouse) {
      return NextResponse.json(
        { success: false, error: "Warehouse not found" },
        { status: 404 }
      )
    }

    if (user.role !== 'root') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (!userCompanyId || (warehouse as any).ownerCompanyId !== userCompanyId) {
        return NextResponse.json(
          { success: false, error: "Forbidden: You can only delete your own company's warehouses" },
          { status: 403 }
        )
      }

      const isAdmin = await isCompanyAdmin(user.id, userCompanyId)
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Only company admins can delete warehouses" },
          { status: 403 }
        )
      }
    }

    const supabase = createAdminClient()

    // Clean up floor plan data first to avoid FK/RLS issues
    const { data: floorIds } = await supabase
      .from("warehouse_floors")
      .select("id")
      .eq("warehouse_id", warehouseId)

    if (floorIds && floorIds.length > 0) {
      const ids = floorIds.map((floor) => floor.id)
      await supabase.from("warehouse_floor_zones").delete().in("floor_id", ids)
      await supabase.from("warehouse_floor_aisle_defs").delete().in("floor_id", ids)
      await supabase.from("warehouse_floor_pallet_layouts").delete().in("floor_id", ids)
      await supabase.from("warehouse_floors").delete().in("id", ids)
    }

    // Soft delete the warehouse by setting status to false
    const { error } = await supabase
      .from("warehouses")
      .update({ status: false, updated_at: new Date().toISOString() })
      .eq("id", warehouseId)

    if (error) {
      console.error('Error deleting warehouse:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete warehouse', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Warehouse deleted successfully',
    })
  } catch (error) {
    console.error("Error deleting warehouse:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}