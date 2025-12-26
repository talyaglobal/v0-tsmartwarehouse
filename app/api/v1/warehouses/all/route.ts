import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getWarehouses } from "@/lib/db/warehouses"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/warehouses/all
 * Get all warehouses with coordinates for map display
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    // Get all warehouses
    const warehouses = await getWarehouses()

    // Filter warehouses with coordinates and format response
    const warehousesWithCoords = warehouses
      .filter((w) => w.latitude && w.longitude)
      .map((w) => ({
        id: w.id,
        name: w.name,
        address: w.address,
        city: w.city,
        zipCode: w.zipCode,
        latitude: w.latitude,
        longitude: w.longitude,
        totalSqFt: w.totalSqFt,
        totalPalletStorage: w.totalPalletStorage,
      }))

    const responseData = {
      success: true,
      data: warehousesWithCoords,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: 'Failed to get all warehouses' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

