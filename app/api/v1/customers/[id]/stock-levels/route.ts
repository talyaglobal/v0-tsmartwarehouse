import { NextRequest, NextResponse } from 'next/server'
import { getCustomerStockLevels } from '@/lib/db/inventory'
import { handleApiError } from '@/lib/utils/logger'

/**
 * GET /api/v1/customers/[id]/stock-levels
 * Get stock levels for a customer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const searchParams = request.nextUrl.searchParams
    const warehouseId = searchParams.get('warehouse_id')

    const stockLevels = await getCustomerStockLevels(
      resolvedParams.id,
      warehouseId || undefined
    )

    return NextResponse.json({
      success: true,
      data: stockLevels,
    })
  } catch (error: any) {
    const errorResponse = handleApiError(error, { context: 'Failed to get customer stock levels' })
    return NextResponse.json(
      {
        error: errorResponse.message,
        ...(errorResponse.code && { code: errorResponse.code }),
      },
      { status: errorResponse.statusCode }
    )
  }
}

