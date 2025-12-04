import { type NextRequest, NextResponse } from "next/server"
import { getBookings, createBooking } from "@/lib/db/bookings"
import { PRICING } from "@/lib/constants"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import type { BookingStatus, BookingType } from "@/types"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId")
    const status = searchParams.get("status") as BookingStatus | null
    const type = searchParams.get("type") as BookingType | null

    const filters: {
      customerId?: string
      status?: BookingStatus
      type?: BookingType
      warehouseId?: string
    } = {}

    if (customerId) filters.customerId = customerId
    if (status) filters.status = status
    if (type) filters.type = type

    const bookings = await getBookings(filters)

    return NextResponse.json({
      success: true,
      data: bookings,
      total: bookings.length,
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/bookings" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const body = await request.json()
    const { type, palletCount, areaSqFt, floorNumber, hallId, startDate, endDate, notes } = body

    // Validate required fields
    if (!type || (!palletCount && !areaSqFt) || !startDate) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: type, palletCount or areaSqFt, and startDate" },
        { status: 400 }
      )
    }

    // Get customer profile information
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 404 }
      )
    }

    // Calculate pricing
    let totalAmount = 0
    if (type === "pallet" && palletCount) {
      const handlingIn = palletCount * PRICING.palletIn
      const storage = palletCount * PRICING.storagePerPalletPerMonth
      totalAmount = handlingIn + storage
    } else if (type === "area-rental" && areaSqFt) {
      if (areaSqFt < PRICING.areaRentalMinSqFt) {
        return NextResponse.json(
          { success: false, error: `Minimum area rental is ${PRICING.areaRentalMinSqFt} sq ft` },
          { status: 400 },
        )
      }
      totalAmount = areaSqFt * PRICING.areaRentalPerSqFtPerYear
    }

    // Create booking using database function
    const newBooking = await createBooking({
      customerId: user.id,
      customerName: profile.name || user.email,
      customerEmail: profile.email || user.email,
      warehouseId: "wh-001",
      type,
      status: "pending",
      palletCount: type === "pallet" ? palletCount : undefined,
      areaSqFt: type === "area-rental" ? areaSqFt : undefined,
      floorNumber: type === "area-rental" ? floorNumber : undefined,
      hallId: type === "area-rental" ? hallId : undefined,
      startDate,
      endDate: endDate || undefined,
      totalAmount,
      notes: notes || undefined,
    })

    return NextResponse.json({
      success: true,
      data: newBooking,
      message: "Booking created successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/bookings", method: "POST" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}
