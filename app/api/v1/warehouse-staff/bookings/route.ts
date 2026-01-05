import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { getBookingsForWarehouseStaff } from "@/lib/business-logic/warehouse-staff"
import type { BookingStatus } from "@/types"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/warehouse-staff/bookings
 * Get bookings for warehouses assigned to the logged-in warehouse staff member
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult

    // Verify user is warehouse staff
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'warehouse_staff') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Only warehouse staff can access this endpoint",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    
    // Handle status filter - can be single value or comma-separated list
    const statusParam = searchParams.get("status")
    let status: BookingStatus | BookingStatus[] | undefined = undefined
    if (statusParam) {
      if (statusParam.includes(',')) {
        status = statusParam.split(',') as BookingStatus[]
      } else {
        status = statusParam as BookingStatus
      }
    }
    
    const warehouseId = searchParams.get("warehouseId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const customerSearch = searchParams.get("customerSearch")
    const sortBy = searchParams.get("sortBy") as 'date' | 'amount' | 'status' | 'warehouse' | null
    const sortOrder = searchParams.get("sortOrder") as 'asc' | 'desc' | null

    // Get bookings for this warehouse staff member
    const bookings = await getBookingsForWarehouseStaff(user.id, {
      status: status,
      warehouseId: warehouseId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      customerSearch: customerSearch || undefined,
      sortBy: sortBy || undefined,
      sortOrder: sortOrder || undefined,
    })

    // Get warehouse assignments to include warehouse names in response
    const { getWarehouseStaffWarehouses } = await import('@/lib/business-logic/warehouse-staff')
    const warehouses = await getWarehouseStaffWarehouses(user.id)
    const warehouseMap = new Map(warehouses.map(w => [w.warehouseId, w.warehouseName]))

    // Enhance bookings with warehouse names
    const bookingsWithWarehouseNames = bookings.map(booking => ({
      ...booking,
      warehouseName: warehouseMap.get(booking.warehouseId) || 'Unknown Warehouse',
    }))

    return NextResponse.json({
      success: true,
      data: bookingsWithWarehouseNames,
      total: bookingsWithWarehouseNames.length,
    })
  } catch (error) {
    console.error("Error fetching warehouse staff bookings:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch bookings",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

