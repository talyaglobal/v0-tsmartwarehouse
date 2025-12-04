import { NextRequest, NextResponse } from 'next/server'
import { searchInventoryByCode } from '@/lib/db/inventory'
import { handleApiError } from '@/lib/utils/logger'

/**
 * GET /api/v1/inventory/search
 * Search for inventory item by barcode/QR code
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json(
        { error: 'Code parameter is required' },
        { status: 400 }
      )
    }

    const item = await searchInventoryByCode(code)

    // Format response for scan page
    const response = {
      id: item.pallet_id,
      type: item.type || item.item_type || 'General',
      location: item.location_code || 'Not assigned',
      status: item.status,
      customer: item.customer || 'Unknown',
    }

    return NextResponse.json({
      success: true,
      data: response,
    })
  } catch (error: any) {
    return handleApiError(error, 'Failed to search inventory')
  }
}

