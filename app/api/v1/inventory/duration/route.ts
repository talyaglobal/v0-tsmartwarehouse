import { NextRequest, NextResponse } from 'next/server'
import { getInventoryItems, calculateStorageDuration } from '@/lib/db/inventory'
import { handleApiError } from '@/lib/utils/logger'

/**
 * GET /api/v1/inventory/duration
 * Get inventory items with storage duration
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customer_id')
    const warehouseId = searchParams.get('warehouse_id')
    const itemId = searchParams.get('item_id')

    if (itemId) {
      // Get duration for specific item
      const duration = await calculateStorageDuration(itemId)
      return NextResponse.json({
        success: true,
        data: duration,
      })
    }

    // Get all items with duration
    const items = await getInventoryItems({
      customerId: customerId || undefined,
      warehouseId: warehouseId || undefined,
    })

    // Calculate duration for each item
    const itemsWithDuration = await Promise.all(
      items.map(async (item) => {
        const duration = await calculateStorageDuration(item.id)
        return {
          ...item,
          calculatedDuration: duration,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: itemsWithDuration,
    })
  } catch (error: any) {
    const errorResponse = handleApiError(error, { context: 'Failed to get inventory duration' })
    return NextResponse.json(
      {
        error: errorResponse.message,
        ...(errorResponse.code && { code: errorResponse.code }),
      },
      { status: errorResponse.statusCode }
    )
  }
}

