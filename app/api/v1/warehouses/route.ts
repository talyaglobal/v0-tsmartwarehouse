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
  totalSqFt: z.number().positive("Total square feet must be positive"),
  totalPalletStorage: z.number().positive("Total pallet storage must be positive"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  warehouseType: z.array(z.enum([
    "general-dry-ambient",
    "food-beverage-fda",
    "pharmaceutical-fda-cgmp",
    "medical-devices-fda",
    "nutraceuticals-supplements-fda",
    "cosmetics-fda",
    "hazardous-materials-hazmat",
    "cold-storage",
    "alcohol-tobacco-ttb",
    "consumer-electronics",
    "automotive-parts",
    "ecommerce-high-velocity",
  ])).min(1, "At least one warehouse type is required"),
  storageTypes: z.array(z.enum(["bulk-space", "rack-space", "individual-unit", "lockable-unit", "cage", "open-yard", "closed-yard"])).min(1, "At least one storage type is required"),
  temperatureTypes: z.array(z.enum(["ambient-with-ac", "ambient-without-ac", "chilled", "frozen", "open-area-with-tent", "open-area"])).min(1, "At least one temperature option is required"),
  amenities: z.array(z.string()).optional(),
  photos: z.array(z.string()).min(2, "At least 2 warehouse photos are required"),
  operatingHours: z.object({
    open: z.string(),
    close: z.string(),
    days: z.array(z.string()),
  }).optional(),
  // New fields
  customStatus: z.enum(["antrepolu", "regular"]).optional(),
  atCapacitySqFt: z.boolean().optional(),
  atCapacityPallet: z.boolean().optional(),
  minPallet: z.number().int().positive().optional(),
  maxPallet: z.number().int().positive().optional(),
  minSqFt: z.number().int().positive().optional(),
  maxSqFt: z.number().int().positive().optional(),
  rentMethods: z.array(z.enum(["pallet", "sq_ft"])).optional(),
  security: z.array(z.string()).optional(),
  // New fields
  videoUrl: z.string().optional(),
  accessInfo: z.object({
    accessType: z.string().optional(),
    appointmentRequired: z.boolean().optional(),
    accessControl: z.string().optional(),
  }).optional(),
  productAcceptanceStartTime: z.string().optional(),
  productAcceptanceEndTime: z.string().optional(),
  workingDays: z.array(z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])).optional(),
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

    // Validate input
    const validated = createWarehouseSchema.parse(body)

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

    // Generate warehouse name automatically (use first warehouse type for name generation)
    const warehouseName = generateWarehouseName(
      validated.city,
      validated.warehouseType[0] || 'general',
      validated.state
    )

    // Get company name for folder structure
    const supabase = createServerSupabaseClient()
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', userCompanyId)
      .single()

    const companyName = company?.name || 'unknown'
    // Sanitize company name and warehouse name for folder paths (remove special chars, spaces to hyphens)
    const sanitizedCompanyName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    const sanitizedWarehouseName = warehouseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

    // Move photos to correct folder structure: warehouse/{company_name}/{warehouse_name}/
    // Photos are already uploaded to temporary location, we'll move them in the API
    // For now, we'll store the paths as-is and move them server-side if needed
    // The file upload API should handle the correct folder structure

    // Create warehouse
    const warehouse = await createWarehouse({
      name: warehouseName,
      address: validated.address,
      city: validated.city,
      zipCode: validated.zipCode || "",
      totalSqFt: validated.totalSqFt || 0,
      totalPalletStorage: validated.totalPalletStorage,
      latitude: validated.latitude,
      longitude: validated.longitude,
      warehouseType: validated.warehouseType,
      storageTypes: validated.storageTypes,
      temperatureTypes: validated.temperatureTypes,
      amenities: validated.amenities || [],
      photos: validated.photos, // Store photo paths
      operatingHours: validated.operatingHours || {
        open: '08:00',
        close: '18:00',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
      ownerCompanyId: userCompanyId,
      // New fields
      customStatus: validated.customStatus,
      atCapacitySqFt: validated.atCapacitySqFt || false,
      atCapacityPallet: validated.atCapacityPallet || false,
      minPallet: validated.minPallet,
      maxPallet: validated.maxPallet,
      minSqFt: validated.minSqFt,
      maxSqFt: validated.maxSqFt,
      rentMethods: validated.rentMethods || [],
      security: validated.security || [],
      videoUrl: validated.videoUrl,
      accessInfo: validated.accessInfo,
      productAcceptanceStartTime: validated.productAcceptanceStartTime,
      productAcceptanceEndTime: validated.productAcceptanceEndTime,
      workingDays: validated.workingDays,
    })

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

