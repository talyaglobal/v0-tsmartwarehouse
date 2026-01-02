import { NextRequest, NextResponse } from 'next/server'
import { getInventoryItems, createInventoryItem, getInventoryStats } from '@/lib/db/inventory'
import { requireAuth } from '@/lib/auth/api-middleware'
import { handleApiError } from '@/lib/utils/logger'
import { z } from 'zod'
import type { ApiResponse, ErrorResponse, ListResponse } from '@/types/api'

/**
 * GET /api/v1/inventory
 * List inventory items with filters
 */
export async function GET(request: NextRequest) {
  try {
    // Try to get authenticated user
    const authResult = await requireAuth(request)
    let authenticatedUserId: string | undefined = undefined
    let userRole: string | null = null
    let warehouseIds: string[] | null = null
    
    if (!(authResult instanceof NextResponse)) {
      authenticatedUserId = authResult.user.id
      
      // Check if user is warehouse staff
      const { createServerSupabaseClient } = await import('@/lib/supabase/server')
      const supabase = createServerSupabaseClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authenticatedUserId)
        .single()
      
      userRole = profile?.role || null
      
      // If warehouse staff, get their assigned warehouses
      if (userRole === 'warehouse_staff') {
        const { getWarehouseStaffWarehouses } = await import('@/lib/business-logic/warehouse-staff')
        const warehouses = await getWarehouseStaffWarehouses(authenticatedUserId)
        warehouseIds = warehouses.map(w => w.warehouseId)
      }
    }

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

    // For warehouse staff, filter by assigned warehouses
    if (warehouseIds && warehouseIds.length > 0) {
      // If specific warehouseId is provided, verify staff has access
      if (filters.warehouseId) {
        if (!warehouseIds.includes(filters.warehouseId)) {
          const errorData: ErrorResponse = {
            success: false,
            error: "You don't have access to this warehouse",
            statusCode: 403,
          }
          return NextResponse.json(errorData, { status: 403 })
        }
      } else {
        // For warehouse staff without specific warehouse filter, we need to fetch for all assigned warehouses
        // Since getInventoryItems only supports single warehouseId, we'll need to fetch all and combine
        const allItems: any[] = []
        for (const warehouseId of warehouseIds) {
          const warehouseItems = await getInventoryItems({
            ...filters,
            warehouseId,
          })
          allItems.push(...warehouseItems)
        }
        
        // If stats requested, calculate for all warehouses
        if (searchParams.get('stats') === 'true') {
          const allStats = await Promise.all(
            warehouseIds.map(warehouseId => getInventoryStats(warehouseId, filters.hallId))
          )
          
          // Combine stats
          const combinedStats = {
            total: allStats.reduce((sum, stat) => sum + (stat.total || 0), 0),
            byStatus: {} as Record<string, number>,
            byHall: {} as Record<string, number>,
          }
          
          allStats.forEach(stat => {
            if (stat.byStatus) {
              Object.entries(stat.byStatus).forEach(([status, count]) => {
                combinedStats.byStatus[status] = (combinedStats.byStatus[status] || 0) + (count as number)
              })
            }
            if (stat.byHall) {
              Object.entries(stat.byHall).forEach(([hall, count]) => {
                combinedStats.byHall[hall] = (combinedStats.byHall[hall] || 0) + (count as number)
              })
            }
          })
          
          const responseData: ApiResponse = {
            success: true,
            data: combinedStats as any,
          }
          return NextResponse.json(responseData)
        }
        
        // Remove duplicates and sort
        const uniqueItems = Array.from(
          new Map(allItems.map(item => [item.id, item])).values()
        )
        
        const responseData: ListResponse<any> = {
          success: true,
          data: uniqueItems,
          total: uniqueItems.length,
        }
        return NextResponse.json(responseData)
      }
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

