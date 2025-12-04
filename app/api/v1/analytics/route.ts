import { NextRequest, NextResponse } from 'next/server'
import {
  getRevenueData,
  getUtilizationData,
  getServiceBreakdown,
  getAnalyticsStats,
  type RevenueData,
  type UtilizationData,
  type ServiceBreakdown,
  type AnalyticsStats,
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
        const revenueResponse: ApiResponse<RevenueData[]> = {
          success: true,
          data: revenueData,
        }
        return NextResponse.json(revenueResponse)

      case 'utilization':
        const utilizationData = await getUtilizationData(months)
        const utilizationResponse: ApiResponse<UtilizationData[]> = {
          success: true,
          data: utilizationData,
        }
        return NextResponse.json(utilizationResponse)

      case 'service-breakdown':
        const serviceBreakdown = await getServiceBreakdown()
        const serviceResponse: ApiResponse<ServiceBreakdown[]> = {
          success: true,
          data: serviceBreakdown,
        }
        return NextResponse.json(serviceResponse)

      case 'stats':
        const stats = await getAnalyticsStats()
        const statsResponse: ApiResponse<AnalyticsStats> = {
          success: true,
          data: stats,
        }
        return NextResponse.json(statsResponse)

      case 'all':
      default:
        const [revenue, utilization, breakdown, analyticsStats] = await Promise.all([
          getRevenueData(months),
          getUtilizationData(months),
          getServiceBreakdown(),
          getAnalyticsStats(),
        ])

        const allDataResponse: ApiResponse<{
          revenue: RevenueData[]
          utilization: UtilizationData[]
          serviceBreakdown: ServiceBreakdown[]
          stats: AnalyticsStats
        }> = {
          success: true,
          data: {
            revenue,
            utilization,
            serviceBreakdown: breakdown,
            stats: analyticsStats,
          },
        }
        return NextResponse.json(allDataResponse)
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

