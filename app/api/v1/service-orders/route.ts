import { type NextRequest, NextResponse } from "next/server"
import { getServiceOrders, createServiceOrder } from "@/lib/db/orders"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { calculateOrderTotal } from "@/lib/business-logic/orders"
import type { ServiceOrderStatus } from "@/types"
import type { ApiResponse, ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/service-orders
 * List service orders with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId")
    const status = searchParams.get("status") as ServiceOrderStatus | null
    const bookingId = searchParams.get("bookingId")

    // Get user role from profiles table for accurate role checking
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    const userRole = profile?.role || user.role

    // Customers can only see their own orders
    // Admins can see all orders
    const filters: {
      customerId?: string
      status?: ServiceOrderStatus
      bookingId?: string
    } = {}

    // Role-based filtering
    if (userRole === "warehouse_client") {
      // Warehouse clients can only see their own orders
      filters.customerId = user.id
    } else if (customerId && userRole === "root") {
      // Root admins can filter by customerId
      filters.customerId = customerId
    } else if (userRole === "root") {
      // Root admins can see all orders (no customerId filter)
    } else {
      // For other roles, default to warehouse_client behavior
      filters.customerId = user.id
    }

    if (status) {
      filters.status = status
    }

    if (bookingId) {
      filters.bookingId = bookingId
    }

    const orders = await getServiceOrders(filters)

    const responseData: ApiResponse<any[]> = {
      success: true,
      data: orders,
      total: orders.length,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/service-orders" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * POST /api/v1/service-orders
 * Create a new service order
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const body = await request.json()

    // Validate required fields
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      const errorData: ErrorResponse = {
        success: false,
        error: "At least one order item is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Get user profile for customer name
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Profile not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Calculate total amount from items
    const totalAmount = calculateOrderTotal(
      body.items.map((item: any) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    )

    // Create order
    const order = await createServiceOrder(
      {
        customerId: user.id,
        customerName: profile.name || profile.email?.split('@')[0] || 'Customer',
        bookingId: body.bookingId || undefined,
        status: body.status || 'draft',
        priority: body.priority || 'normal',
        requestedDate: body.requestedDate || undefined,
        dueDate: body.dueDate || undefined,
        notes: body.notes || undefined,
        totalAmount,
      },
      body.items.map((item: any) => ({
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        notes: item.notes,
        status: 'pending' as const,
      }))
    )

    const responseData: ApiResponse<any> = {
      success: true,
      data: order,
      message: "Service order created successfully",
    }
    return NextResponse.json(responseData, { status: 201 })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/service-orders", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

