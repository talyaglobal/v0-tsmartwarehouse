import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { createBookingOnBehalf } from "@/lib/business-logic/bookings"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ApiResponse, ErrorResponse } from "@/types/api"
import type { BookingType, MembershipTier } from "@/types"

/**
 * POST /api/v1/bookings/on-behalf
 * Create a booking on behalf of a team member
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const {
      customerId,
      warehouseId,
      type,
      palletCount,
      areaSqFt,
      floorNumber,
      hallId,
      startDate,
      endDate,
      months,
      notes,
      requiresApproval = false,
      requestMessage,
    } = body

    // Validate required fields
    if (!customerId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Customer ID is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (!warehouseId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Warehouse ID is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (!type || (type !== "pallet" && type !== "area-rental")) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Booking type must be "pallet" or "area-rental"',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (!startDate) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Start date is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Get customer info
    const supabase = await createServerSupabaseClient()
    const { data: customerProfile, error: customerError } = await supabase
      .from("profiles")
      .select("name, email, membership_tier")
      .eq("id", customerId)
      .single()

    if (customerError || !customerProfile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Customer not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Get booker info
    const { data: bookerProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", authResult.user.id)
      .single()

    const result = await createBookingOnBehalf({
      customerId,
      customerName: customerProfile.name || customerProfile.email,
      customerEmail: customerProfile.email,
      warehouseId,
      type: type as BookingType,
      palletCount,
      areaSqFt,
      floorNumber,
      hallId,
      startDate,
      endDate,
      months,
      notes,
      membershipTier: customerProfile.membership_tier as MembershipTier | undefined,
      bookedById: authResult.user.id,
      bookedByName: bookerProfile?.name || bookerProfile?.email || "Team Admin",
      requiresApproval,
      requestMessage,
    })

    const responseData: ApiResponse = {
      success: true,
      data: {
        booking: result.booking,
        approval: result.approval,
        bookedOnBehalf: result.bookedOnBehalf,
      },
      message: result.message,
    }
    return NextResponse.json(responseData, { status: 201 })
  } catch (error) {
    const errorResponse = handleApiError(error, {
      path: "/api/v1/bookings/on-behalf",
      method: "POST",
    })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
