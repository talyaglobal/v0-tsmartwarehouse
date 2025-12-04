import { NextRequest, NextResponse } from 'next/server'
import {
  getRevenueData,
  getUtilizationData,
  getServiceBreakdown,
  getAnalyticsStats,
} from '@/lib/db/analytics'
import { handleApiError } from '@/lib/utils/logger'
import type { ApiResponse, ErrorResponse } from '@/types/api'

/**
 * GET /api/v1/analytics
 * Get analytics data (revenue, utilization, service breakdown, stats)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'all'
    const months = searchParams.get('months') ? parseInt(searchParams.get('months')!) : 6

    switch (type) {
      case 'revenue':
        const revenueData = await getRevenueData(months)
        const responseData: ApiResponse = {
          success: true,
          data: revenueData as any,
        }
        return NextResponse.json(responseData)

      case 'utilization':
        const utilizationData = await getUtilizationData(months)
        const responseData: ApiResponse = {
          success: true,
          data: utilizationData as any,
        }
        return NextResponse.json(responseData)

      case 'service-breakdown':
        const serviceBreakdown = await getServiceBreakdown()
        const responseData: ApiResponse = {
          success: true,
          data: serviceBreakdown as any,
        }
        return NextResponse.json(responseData)

      case 'stats':
        const stats = await getAnalyticsStats()
        const responseData: ApiResponse = {
          success: true,
          data: stats as any,
        }
        return NextResponse.json(responseData)

      case 'all':
      default:
        const [revenue, utilization, breakdown, analyticsStats] = await Promise.all([
          getRevenueData(months),
          getUtilizationData(months),
          getServiceBreakdown(),
          getAnalyticsStats(),
        ])

        const responseData: ApiResponse = {
          success: true,
          data: {
            revenue,
            utilization,
            serviceBreakdown: breakdown,
            stats: analyticsStats,
          } as any,
        }
        return NextResponse.json(responseData)
    }
  } catch (error: any) {
    const errorResponse = handleApiError(error, { path: '/api/v1/analytics' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

