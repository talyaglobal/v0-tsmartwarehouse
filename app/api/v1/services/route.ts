import { type NextRequest, NextResponse } from "next/server"
import { getServices } from "@/lib/db/services"
import { handleApiError } from "@/lib/utils/logger"
import type { ServiceCategory } from "@/types"
import type { ApiResponse, ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/services
 * List warehouse services with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category") as ServiceCategory | null
    const isActive = searchParams.get("isActive") !== "false" // Default to true

    const filters: {
      category?: ServiceCategory
      isActive?: boolean
    } = {}

    if (category) {
      filters.category = category
    }

    filters.isActive = isActive

    const services = await getServices(filters)

    const responseData: ApiResponse<any[]> = {
      success: true,
      data: services,
      total: services.length,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/services" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

