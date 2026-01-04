import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { getWarehouseStaffWarehouses } from "@/lib/business-logic/warehouse-staff"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/warehouse-staff/warehouses
 * Get all warehouses assigned to the logged-in warehouse staff member
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

    // Get warehouses assigned to this warehouse staff member
    const warehouses = await getWarehouseStaffWarehouses(user.id)

    return NextResponse.json({
      success: true,
      data: warehouses,
      total: warehouses.length,
    })
  } catch (error) {
    console.error("Error fetching warehouse staff warehouses:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch warehouses",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

