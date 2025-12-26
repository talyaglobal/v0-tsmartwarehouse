import { NextRequest, NextResponse } from 'next/server'
import {
  getPerformanceMetrics,
  getBrokers,
  getCustomerGroups,
  type PerformanceMetrics,
  type Broker,
  type CustomerGroup,
  type PerformanceFilters,
} from '@/lib/db/performance'
import { handleApiError } from '@/lib/utils/logger'
import type { ApiResponse, ErrorResponse } from '@/types/api'

/**
 * GET /api/v1/performance
 * Get performance metrics with optional filters
 * Query parameters:
 *   - floor: number (1, 2, or 3)
 *   - warehouseId: string
 *   - customerId: string
 *   - brokerId: string
 *   - customerGroupId: string
 *   - type: 'metrics' | 'brokers' | 'groups' | 'all'
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'metrics'

    // Build filters from query parameters
    const filters: PerformanceFilters = {}
    
    const floor = searchParams.get('floor')
    if (floor) {
      const floorNum = parseInt(floor)
      if ([1, 2, 3].includes(floorNum)) {
        filters.floor = floorNum
      }
    }

    const warehouseId = searchParams.get('warehouseId')
    if (warehouseId) {
      filters.warehouseId = warehouseId
    }

    const customerId = searchParams.get('customerId')
    if (customerId) {
      filters.customerId = customerId
    }

    const brokerId = searchParams.get('brokerId')
    if (brokerId) {
      filters.brokerId = brokerId
    }

    const customerGroupId = searchParams.get('customerGroupId')
    if (customerGroupId) {
      filters.customerGroupId = customerGroupId
    }

    switch (type) {
      case 'metrics': {
        const metrics = await getPerformanceMetrics(filters)
        const metricsResponse: ApiResponse<PerformanceMetrics> = {
          success: true,
          data: metrics,
        }
        return NextResponse.json(metricsResponse)
      }

      case 'brokers': {
        const brokers = await getBrokers()
        const brokersResponse: ApiResponse<Broker[]> = {
          success: true,
          data: brokers,
        }
        return NextResponse.json(brokersResponse)
      }

      case 'groups': {
        const groups = await getCustomerGroups()
        const groupsResponse: ApiResponse<CustomerGroup[]> = {
          success: true,
          data: groups,
        }
        return NextResponse.json(groupsResponse)
      }

      case 'all': {
        const [metrics, brokers, groups] = await Promise.all([
          getPerformanceMetrics(filters),
          getBrokers(),
          getCustomerGroups(),
        ])

        const allDataResponse: ApiResponse<{
          metrics: PerformanceMetrics
          brokers: Broker[]
          groups: CustomerGroup[]
        }> = {
          success: true,
          data: {
            metrics,
            brokers,
            groups,
          },
        }
        return NextResponse.json(allDataResponse)
      }

      default: {
        const metrics = await getPerformanceMetrics(filters)
        const metricsResponse: ApiResponse<PerformanceMetrics> = {
          success: true,
          data: metrics,
        }
        return NextResponse.json(metricsResponse)
      }
    }
  } catch (error: any) {
    const errorResponse = handleApiError(error, { path: '/api/v1/performance' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

