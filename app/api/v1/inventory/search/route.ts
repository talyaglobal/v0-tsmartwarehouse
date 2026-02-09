import { NextRequest, NextResponse } from 'next/server'
import { searchInventoryByCode } from '@/lib/db/inventory'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/utils/logger'

const OPERATIONS = ['check_in', 'check_out', 'move', 'scan_view'] as const

/**
 * GET /api/v1/inventory/search
 * Search for inventory item by barcode/QR code. Logs scan to pallet_operation_logs when authenticated.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const operationParam = searchParams.get('operation') || 'scan_view'
    const operation = OPERATIONS.includes(operationParam as any) ? operationParam : 'scan_view'

    if (!code) {
      return NextResponse.json(
        { error: 'Code parameter is required' },
        { status: 400 }
      )
    }

    const item = await searchInventoryByCode(code)

    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user && item.id && item.booking_id && item.warehouse_id) {
      await supabase.from('pallet_operation_logs').insert({
        inventory_item_id: item.id,
        booking_id: item.booking_id,
        warehouse_id: item.warehouse_id,
        operation,
        performed_by: user.id,
        performed_at: new Date().toISOString(),
        metadata: { code: code.slice(0, 100) },
      })
    }

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
    const errorResponse = handleApiError(error, { context: 'Failed to search inventory' })
    return NextResponse.json(
      {
        error: errorResponse.message,
        ...(errorResponse.code && { code: errorResponse.code }),
      },
      { status: errorResponse.statusCode }
    )
  }
}

