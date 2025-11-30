import { type NextRequest, NextResponse } from "next/server"
import { mockBookings } from "@/lib/mock-data"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const booking = mockBookings.find((b) => b.id === id)

  if (!booking) {
    return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: booking })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const bookingIndex = mockBookings.findIndex((b) => b.id === id)
  if (bookingIndex === -1) {
    return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 })
  }

  // In a real app, this would update the database
  const updatedBooking = {
    ...mockBookings[bookingIndex],
    ...body,
    updatedAt: new Date().toISOString(),
  }

  return NextResponse.json({
    success: true,
    data: updatedBooking,
    message: "Booking updated successfully",
  })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const booking = mockBookings.find((b) => b.id === id)

  if (!booking) {
    return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    message: "Booking deleted successfully",
  })
}
