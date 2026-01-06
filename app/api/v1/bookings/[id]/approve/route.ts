import { NextRequest, NextResponse } from "next/server"
import { getBookingById } from "@/lib/db/bookings"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, BookingResponse } from "@/types/api"
import { getCurrentUser } from "@/lib/auth/utils"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { activateBooking } from "@/lib/business-logic/bookings"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const booking = await getBookingById(bookingId)
    if (!booking) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Booking not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Verify user is warehouse staff/admin/owner for this warehouse
    const supabase = createServerSupabaseClient()
    const { data: warehouse } = await supabase
      .from("warehouses")
      .select("owner_company_id")
      .eq("id", booking.warehouseId)
      .single()

    if (!warehouse) {
      return NextResponse.json(
        { success: false, error: "Warehouse not found" },
        { status: 404 }
      )
    }

    // Check if user is warehouse staff, admin, or owner
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", currentUser.id)
      .single()

    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 404 }
      )
    }

    const isWarehouseStaff =
      userProfile.role === "warehouse_staff" ||
      userProfile.role === "warehouse_admin" ||
      userProfile.role === "warehouse_owner" ||
      userProfile.role === "root"

    const isCompanyMember = userProfile.company_id === warehouse.owner_company_id

    if (!isWarehouseStaff || !isCompanyMember) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only warehouse staff can approve bookings" },
        { status: 403 }
      )
    }

    // Check if booking is in pending status
    if (booking.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `Booking is not in pending status. Current status: ${booking.status}`,
        },
        { status: 400 }
      )
    }

    // Activate the booking
    const updatedBooking = await activateBooking(bookingId)

    const responseData: BookingResponse = {
      success: true,
      data: updatedBooking,
      message: "Booking approved and activated successfully",
    }
    return NextResponse.json(responseData, { status: 200 })
  } catch (error) {
    const { id } = await params
    const errorResponse = handleApiError(error, {
      path: `/api/v1/bookings/${id}/approve`,
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
