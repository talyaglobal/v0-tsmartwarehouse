import { NextRequest, NextResponse } from 'next/server'
import { getInventoryByCustomerLot, getInventoryWithTracking, createInventoryItem } from '@/lib/db/inventory'
import { handleApiError } from '@/lib/utils/logger'
import type { InventoryItem } from '@/lib/db/inventory'

/**
 * GET /api/v1/inventory/tracking
 * Search by warehouse tracking number, customer lot/batch
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const trackingNumber = searchParams.get('tracking_number')
    const lotNumber = searchParams.get('lot_number')
    const batchNumber = searchParams.get('batch_number')
    const customerId = searchParams.get('customer_id')

    if (trackingNumber) {
      // Search by warehouse tracking number
      const items = await getInventoryWithTracking({
        search: trackingNumber,
        customerId: customerId || undefined,
      })
      return NextResponse.json({
        success: true,
        data: items,
      })
    }

    if (lotNumber || batchNumber) {
      // Search by customer lot/batch
      const items = await getInventoryByCustomerLot(
        lotNumber || undefined,
        batchNumber || undefined,
        customerId || undefined
      )
      return NextResponse.json({
        success: true,
        data: items,
      })
    }

    return NextResponse.json(
      { error: 'tracking_number, lot_number, or batch_number parameter is required' },
      { status: 400 }
    )
  } catch (error: any) {
    const errorResponse = handleApiError(error, { context: 'Failed to search inventory tracking' })
    return NextResponse.json(
      {
        error: errorResponse.message,
        ...(errorResponse.code && { code: errorResponse.code }),
      },
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * POST /api/v1/inventory/tracking
 * Create inventory with tracking numbers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const item = await createInventoryItem(body as Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>)

    return NextResponse.json({
      success: true,
      data: item,
    })
  } catch (error: any) {
    const errorResponse = handleApiError(error, { context: 'Failed to create inventory with tracking' })
    return NextResponse.json(
      {
        error: errorResponse.message,
        ...(errorResponse.code && { code: errorResponse.code }),
      },
      { status: errorResponse.statusCode }
    )
  }
}

