import { type NextRequest, NextResponse } from "next/server"
import { mockBookings } from "@/lib/mock-data"
import { PRICING } from "@/lib/constants"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get("customerId")
  const status = searchParams.get("status")
  const type = searchParams.get("type")

  let bookings = [...mockBookings]

  if (customerId) {
    bookings = bookings.filter((b) => b.customerId === customerId)
  }
  if (status) {
    bookings = bookings.filter((b) => b.status === status)
  }
  if (type) {
    bookings = bookings.filter((b) => b.type === type)
  }

  return NextResponse.json({
    success: true,
    data: bookings,
    total: bookings.length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, type, palletCount, areaSqFt, floorNumber, startDate, endDate, notes } = body

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

    const newBooking = {
      id: `book-${Date.now()}`,
      customerId,
      customerName: "Customer",
      customerEmail: "customer@example.com",
      warehouseId: "wh-001",
      type,
      status: "pending",
      palletCount,
      areaSqFt,
      floorNumber,
      startDate,
      endDate,
      totalAmount,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: newBooking,
      message: "Booking created successfully",
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
}
