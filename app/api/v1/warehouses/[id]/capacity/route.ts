import { NextRequest, NextResponse } from 'next/server'
import { getCapacityUtilization } from '@/lib/db/warehouses'
import { handleApiError } from '@/lib/utils/logger'

/**
 * GET /api/v1/warehouses/[id]/capacity
 * Get capacity utilization (warehouse/zone/customer level)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const searchParams = request.nextUrl.searchParams
    const zoneId = searchParams.get('zone_id')
    const customerId = searchParams.get('customer_id')
    const level = searchParams.get('level') || 'warehouse' // warehouse, zone, customer

    let capacityData

    if (level === 'zone' && zoneId) {
      capacityData = await getCapacityUtilization(resolvedParams.id, zoneId)
    } else if (level === 'customer' && customerId) {
      capacityData = await getCapacityUtilization(resolvedParams.id, undefined, customerId)
    } else {
      // Warehouse level
      capacityData = await getCapacityUtilization(resolvedParams.id)
    }

    return NextResponse.json({
      success: true,
      data: capacityData,
      level,
    })
  } catch (error: any) {
    const errorResponse = handleApiError(error, { context: 'Failed to get capacity utilization' })
    return NextResponse.json(
      {
        error: errorResponse.message,
        ...(errorResponse.code && { code: errorResponse.code }),
      },
      { status: errorResponse.statusCode }
    )
  }
}

