import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { getAvailableTimeSlots, checkWarehouseAvailability } from "@/lib/business-logic/availability"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/warehouses/[id]/availability
 * Get available time slots for a specific warehouse and date
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const warehouseId = params.id
    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")
    const time = searchParams.get("time")

    if (!date) {
      const errorData: ErrorResponse = {
        success: false,
        error: "date parameter is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // If time is provided, check specific availability
    if (time) {
      const availability = await checkWarehouseAvailability(
        warehouseId,
        date,
        time
      )

      return NextResponse.json({
        success: true,
        data: {
          available: availability.available,
          reason: availability.reason,
          conflictingBookings: availability.conflictingBookings.map((b) => ({
            id: b.id,
            startDate: b.startDate,
            status: b.status,
          })),
        },
      })
    }

    // Otherwise, get all available time slots for the date
    const timeSlots = await getAvailableTimeSlots(warehouseId, date)

    return NextResponse.json({
      success: true,
      data: {
        date,
        timeSlots,
        availableCount: timeSlots.filter((slot) => slot.available).length,
        totalCount: timeSlots.length,
      },
    })
  } catch (error) {
    console.error("Error checking warehouse availability:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check availability",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}
