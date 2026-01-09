import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ListResponse, ApiResponse } from "@/types/api"
import { createWarehouse, getWarehouses } from "@/lib/db/warehouses"
import { generateWarehouseName } from "@/lib/utils/warehouse-name-generator"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { z } from "zod"

const createWarehouseSchema = z.object({
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(), // State for name generation
  zipCode: z.string().optional(),
  totalSqFt: z.number().positive("Total square feet must be positive").optional(),
  totalPalletStorage: z.number().positive("Total pallet storage must be positive").optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  warehouseType: z.array(z.string()).min(1, "At least one warehouse type is required"), // Changed to array
  storageType: z.array(z.string()).min(1, "At least one storage type is required"), // Changed to array
  temperatureTypes: z.array(z.enum(["ambient-with-ac", "ambient-without-ac", "ambient-with-heater", "ambient-without-heater", "chilled", "frozen", "open-area-with-tent", "open-area"])).min(1, "At least one temperature option is required"),
  amenities: z.array(z.string()).optional(),
  photos: z.array(z.string()).min(2, "At least 2 warehouse photos are required"),
  operatingHours: z.object({
    open: z.string(),
    close: z.string(),
    days: z.array(z.string()),
  }).optional(),
  // New fields
  customStatus: z.enum(["antrepolu", "regular"]).optional(),
  minPallet: z.number().int().positive().optional(),
  maxPallet: z.number().int().positive().optional(),
  minSqFt: z.number().int().positive().optional(),
  maxSqFt: z.number().int().positive().optional(),
  rentMethods: z.array(z.enum(["pallet", "sq_ft"])).optional(),
  security: z.array(z.string()).optional(),
  // New fields
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
    palletType: z.enum(["euro", "standard", "custom"]),
    pricingPeriod: z.enum(["day", "week", "month"]),
    stackable: z.boolean().optional(), // Stackable or unstackable option
    customDimensions: z.object({
      length: z.number().nonnegative(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative(),
      unit: z.enum(["cm", "in"]).optional(),
    }).optional(),
    heightRanges: z.array(z.object({
      heightMinCm: z.number().nonnegative(),
      heightMaxCm: z.number().positive(),
      pricePerUnit: z.number().nonnegative(),
    })).optional(),
    weightRanges: z.array(z.object({
      weightMinKg: z.number().nonnegative(),
      weightMaxKg: z.number().positive(),
      pricePerPallet: z.number().nonnegative(),
    })).optional(),
  })).optional(), // New field
  workingDays: z.array(z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])).optional(),
  // Warehouse fees
  warehouseInFee: z.number().nonnegative().optional(),
  warehouseOutFee: z.number().nonnegative().optional(),
  // Transportation
  ports: z.array(z.object({
    name: z.string().min(1, "Port name is required"),
    container40DC: z.number().nonnegative().optional(),
    container40HC: z.number().nonnegative().optional(),
    container20DC: z.number().nonnegative().optional(),
  })).optional(),
  // Pricing (will be handled separately in warehouse_pricing table)
  pricing: z.array(z.object({
    pricing_type: z.enum(["pallet", "pallet-monthly", "area", "area-rental"]),
    base_price: z.number().positive(),
    unit: z.string(),
    min_quantity: z.number().int().nonnegative().nullable().optional(),
    max_quantity: z.number().int().nonnegative().nullable().optional(),
    volume_discounts: z.record(z.string(), z.number()).nullable().optional(),
  })).min(1, "At least one pricing entry is required"),
}).refine((data) => {
  // At least one of totalSqFt or totalPalletStorage must be provided
  return data.totalSqFt !== undefined || data.totalPalletStorage !== undefined;
}, {
  message: "At least one of totalSqFt or totalPalletStorage is required",
  path: ["totalSqFt"],
})

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")

    // Check permissions
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

      // Company admins can only see their own company's warehouses
      if (companyId && companyId !== userCompanyId) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: You can only view your own company's warehouses",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }

      // Use user's company ID if no companyId specified
      const targetCompanyId = companyId || userCompanyId
      const warehouses = await getWarehouses({ ownerCompanyId: targetCompanyId })

      const responseData: ListResponse<any> = {
        success: true,
        data: warehouses,
        total: warehouses.length,
      }
      return NextResponse.json(responseData)
    } else {
      // Root users can see all warehouses or filter by company
      const warehouses = await getWarehouses(
        companyId ? { ownerCompanyId: companyId } : undefined
      )

      const responseData: ListResponse<any> = {
        success: true,
        data: warehouses,
        total: warehouses.length,
      }
      return NextResponse.json(responseData)
    }
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/warehouses", method: "GET" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

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

      const isAdmin = await isCompanyAdmin(user.id, userCompanyId)
      if (!isAdmin) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: Only company admins can create warehouses",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    }

    const body = await request.json()

    // Debug: Log overtimePrice before validation
    if (body.overtimePrice) {
      console.log('[API] OvertimePrice received:', JSON.stringify(body.overtimePrice, null, 2))
    }

    // Validate input
    const validated = createWarehouseSchema.parse(body)
    
    // Debug: Log overtimePrice after validation
    if (validated.overtimePrice) {
      console.log('[API] OvertimePrice validated:', JSON.stringify(validated.overtimePrice, null, 2))
    }

    // Get user's company ID
    const userCompanyId = user.role === 'root' 
      ? body.ownerCompanyId 
      : await getUserCompanyId(user.id)

    if (!userCompanyId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Company ID is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Generate warehouse name automatically (use first warehouse type if array)
    const warehouseName = generateWarehouseName(
      validated.city,
      Array.isArray(validated.warehouseType) ? validated.warehouseType[0] : validated.warehouseType || 'general',
      validated.state
    )

    // TODO: Implement photo organization by company/warehouse folder structure
    // For now, we'll store the paths as-is and move them server-side if needed
    // The file upload API should handle the correct folder structure

    // Create warehouse
    const warehouse = await createWarehouse({
      name: warehouseName,
      address: validated.address,
      city: validated.city,
      zipCode: validated.zipCode || "",
      totalSqFt: validated.totalSqFt || 0,
      totalPalletStorage: validated.totalPalletStorage || 0,
      latitude: validated.latitude,
      longitude: validated.longitude,
      warehouseType: validated.warehouseType, // Now an array
      storageTypes: validated.storageType, // Now an array
      temperatureTypes: validated.temperatureTypes,
      amenities: validated.amenities || [],
      photos: validated.photos, // Store photo paths
      videos: validated.videos || [], // New field - videos array
      operatingHours: validated.operatingHours || {
        open: validated.productAcceptanceTimeSlots && validated.productAcceptanceTimeSlots.length > 0
          ? validated.productAcceptanceTimeSlots[0].start
          : '08:00',
        close: validated.productAcceptanceTimeSlots && validated.productAcceptanceTimeSlots.length > 0
          ? validated.productAcceptanceTimeSlots[validated.productAcceptanceTimeSlots.length - 1].end
          : '18:00',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
      ownerCompanyId: userCompanyId,
      // New fields
      customStatus: validated.customStatus,
      minPallet: validated.minPallet,
      maxPallet: validated.maxPallet,
      minSqFt: validated.minSqFt,
      maxSqFt: validated.maxSqFt,
      rentMethods: validated.rentMethods || [],
      security: validated.security || [],
      accessInfo: validated.accessInfo,
      productAcceptanceTimeSlots: validated.productAcceptanceTimeSlots || [], // New field - time slots array
      productDepartureTimeSlots: validated.productDepartureTimeSlots || [], // New field
      workingDays: validated.workingDays,
      warehouseInFee: validated.warehouseInFee,
      warehouseOutFee: validated.warehouseOutFee,
      overtimePrice: validated.overtimePrice, // New field
    })

    // Create pricing entries if provided
    if (validated.pricing && validated.pricing.length > 0) {
      const supabase = await createServerSupabaseClient()
      for (const price of validated.pricing) {
        await supabase.from('warehouse_pricing').insert({
          warehouse_id: warehouse.id,
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

    // Create pallet pricing entries if provided
    if (validated.palletPricing && validated.palletPricing.length > 0) {
      const supabase = await createServerSupabaseClient()
      
      // For custom pallet type, find customDimensions from any period (they should be the same across all periods)
      const customPalletPricing = validated.palletPricing.find(p => p.palletType === 'custom')
      const customDimensions = customPalletPricing?.customDimensions || null
      
      for (const palletPrice of validated.palletPricing) {
        // Insert base pallet pricing record
        // For custom pallet type, use customDimensions from any period (they should be the same)
        const dimensionsToUse = palletPrice.palletType === 'custom' 
          ? (palletPrice.customDimensions || customDimensions)
          : null
        
        const { data: palletPricingRecord, error: palletError } = await supabase
          .from('warehouse_pallet_pricing')
          .insert({
            warehouse_id: warehouse.id,
            pallet_type: palletPrice.palletType,
            pricing_period: palletPrice.pricingPeriod,
            stackable: palletPrice.stackable !== undefined ? palletPrice.stackable : true, // Default to true if not specified
            custom_length_cm: dimensionsToUse?.length && dimensionsToUse.length > 0 ? dimensionsToUse.length : null,
            custom_width_cm: dimensionsToUse?.width && dimensionsToUse.width > 0 ? dimensionsToUse.width : null,
            custom_height_cm: dimensionsToUse?.height && dimensionsToUse.height > 0 ? dimensionsToUse.height : null,
            status: true,
          })
          .select()
          .single()

        if (palletError || !palletPricingRecord) {
          console.error('Error creating pallet pricing:', palletError)
          continue
        }

        // Insert height range pricing
        if (palletPrice.heightRanges && palletPrice.heightRanges.length > 0) {
          await supabase.from('warehouse_pallet_height_pricing').insert(
            palletPrice.heightRanges.map(range => ({
              pallet_pricing_id: palletPricingRecord.id,
              height_min_cm: range.heightMinCm,
              height_max_cm: range.heightMaxCm,
              price_per_unit: range.pricePerUnit,
              status: true,
            }))
          )
        }

        // Insert weight range pricing
        if (palletPrice.weightRanges && palletPrice.weightRanges.length > 0) {
          await supabase.from('warehouse_pallet_weight_pricing').insert(
            palletPrice.weightRanges.map(range => ({
              pallet_pricing_id: palletPricingRecord.id,
              weight_min_kg: range.weightMinKg,
              weight_max_kg: range.weightMaxKg,
              price_per_pallet: range.pricePerPallet,
              status: true,
            }))
          )
        }
      }
    }

    const responseData: ApiResponse = {
      success: true,
      data: warehouse,
      message: "Warehouse created successfully",
    }
    return NextResponse.json(responseData, { status: 201 })
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

    const errorResponse = handleApiError(error, { path: "/api/v1/warehouses", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

