import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ListResponse, ApiResponse } from "@/types/api"
import { createWarehouse, getWarehouses } from "@/lib/db/warehouses"
import { z } from "zod"

const createWarehouseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  zipCode: z.string().min(1, "Zip code is required"),
  totalSqFt: z.number().positive("Total square feet must be positive"),
  totalPalletStorage: z.number().positive("Total pallet storage must be positive").optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  amenities: z.array(z.string()).optional(),
  operatingHours: z.object({
    open: z.string(),
    close: z.string(),
    days: z.array(z.string()),
  }).optional(),
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

    // Create warehouse
    const warehouse = await createWarehouse({
      ...validated,
      amenities: validated.amenities || [],
      operatingHours: validated.operatingHours || {
        open: '08:00',
        close: '18:00',
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
      ownerCompanyId: userCompanyId,
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

