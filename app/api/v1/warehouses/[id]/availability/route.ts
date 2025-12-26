import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { calculateWarehouseAvailability } from "@/lib/business-logic/capacity-management"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/warehouses/[id]/availability
 * Get warehouse availability for a specific date range
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id: warehouseId } = await params
    const { searchParams } = new URL(request.url)

    // Get query parameters
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const bookingType = searchParams.get('bookingType') as 'pallet' | 'area-rental' | null

    // Validate required parameters
    if (!fromDate || !toDate) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Missing required parameters: fromDate and toDate are required',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (!bookingType || !['pallet', 'area-rental'].includes(bookingType)) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Invalid bookingType. Must be "pallet" or "area-rental"',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Validate date format (basic check)
    const fromDateObj = new Date(fromDate)
    const toDateObj = new Date(toDate)

    if (isNaN(fromDateObj.getTime()) || isNaN(toDateObj.getTime())) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD format',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (fromDateObj > toDateObj) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'fromDate must be before or equal to toDate',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Calculate availability
    const availability = await calculateWarehouseAvailability(
      warehouseId,
      fromDate,
      toDate,
      bookingType
    )

    const responseData = {
      success: true,
      data: availability,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: 'Failed to get warehouse availability' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

