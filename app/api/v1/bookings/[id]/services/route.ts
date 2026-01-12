import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const resolvedParams = await params
    const bookingId = resolvedParams.id

    const supabase = createServerSupabaseClient()

    // Get booking to verify access
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('customer_id, warehouse_id')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Booking not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check if user has access to this booking
    // User can access if:
    // 1. They are the customer who made the booking
    // 2. They are a company admin of the warehouse company
    const isCustomer = booking.customer_id === user.id

    if (!isCustomer) {
      // Check if user is company admin of warehouse company
      const { data: warehouse } = await supabase
        .from('warehouses')
        .select('company_id')
        .eq('id', booking.warehouse_id)
        .single()

      if (warehouse?.company_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id, role')
          .eq('id', user.id)
          .single()

        const isCompanyAdmin = profile?.company_id === warehouse.company_id && (profile?.role === 'warehouse_admin' || profile?.role === 'warehouse_supervisor')
        if (!isCompanyAdmin) {
          const errorData: ErrorResponse = {
            success: false,
            error: "Access denied",
            statusCode: 403,
          }
          return NextResponse.json(errorData, { status: 403 })
        }
      } else {
        const errorData: ErrorResponse = {
          success: false,
          error: "Access denied",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    }

    // Get booking services
    const { data: services, error: servicesError } = await supabase
      .from('booking_services')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })

    if (servicesError) {
      throw new Error(`Failed to fetch booking services: ${servicesError.message}`)
    }

    const servicesAmount = services?.reduce((sum, s) => sum + (parseFloat(s.calculated_price?.toString() || '0') || 0), 0) || 0

    return NextResponse.json({
      success: true,
      data: {
        services: services || [],
        servicesAmount,
      },
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: `/api/v1/bookings/[id]/services`, method: "GET" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

