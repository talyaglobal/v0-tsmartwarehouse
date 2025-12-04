import { NextRequest, NextResponse } from 'next/server'
import { getInventoryItems, createInventoryItem, getInventoryStats } from '@/lib/db/inventory'
import { handleApiError } from '@/lib/utils/logger'
import { z } from 'zod'
import type { ApiResponse, ErrorResponse, ListResponse } from '@/types/api'

/**
 * GET /api/v1/inventory
 * List inventory items with filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    const filters = {
      bookingId: searchParams.get('booking_id') || undefined,
      customerId: searchParams.get('customer_id') || undefined,
      warehouseId: searchParams.get('warehouse_id') || undefined,
      hallId: searchParams.get('hall_id') || undefined,
      zoneId: searchParams.get('zone_id') || undefined,
      status: searchParams.get('status') as any || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    }

    // If stats requested
    if (searchParams.get('stats') === 'true') {
      const stats = await getInventoryStats(
        filters.warehouseId,
        filters.hallId
      )
      const responseData: ApiResponse = {
        success: true,
        data: stats as any,
      }
      return NextResponse.json(responseData)
    }

    const items = await getInventoryItems(filters)

    const responseData: ListResponse<any> = {
      success: true,
      data: items,
      total: items.length,
    }
    return NextResponse.json(responseData)
  } catch (error: any) {
    const errorResponse = handleApiError(error, { path: '/api/v1/inventory' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * POST /api/v1/inventory
 * Create a new inventory item
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const schema = z.object({
      booking_id: z.string().uuid(),
      customer_id: z.string().uuid(),
      warehouse_id: z.string().uuid(),
      pallet_id: z.string().min(1),
      barcode: z.string().optional(),
      qr_code: z.string().optional(),
      description: z.string().optional(),
      item_type: z.string().optional(),
      weight_kg: z.number().optional(),
      dimensions: z.any().optional(),
      location_code: z.string().optional(),
      row_number: z.number().optional(),
      level_number: z.number().optional(),
      status: z.enum(['in-transit', 'received', 'stored', 'moved', 'shipped', 'damaged', 'lost']).default('received'),
      floor_id: z.string().uuid().optional().nullable(),
      hall_id: z.string().uuid().optional().nullable(),
      zone_id: z.string().uuid().optional().nullable(),
      notes: z.string().optional(),
    })

    const validated = schema.parse(body)

    const item = await createInventoryItem(validated)

    const responseData: ApiResponse = {
      success: true,
      data: item as any,
    }
    return NextResponse.json(responseData, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Validation error',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      }
      return NextResponse.json(errorData, { status: 400 })
    }
    const errorResponse = handleApiError(error, { path: '/api/v1/inventory', method: 'POST' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

