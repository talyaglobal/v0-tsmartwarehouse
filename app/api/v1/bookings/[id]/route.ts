import { type NextRequest, NextResponse } from "next/server"
import { getBookingById, updateBooking, deleteBooking } from "@/lib/db/bookings"
import { handleApiError } from "@/lib/utils/logger"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const booking = await getBookingById(id)

    if (!booking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: booking })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: `/api/v1/bookings/${(await params).id}` })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    // Check if booking exists
    const existingBooking = await getBookingById(id)
    if (!existingBooking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 })
    }

    // Update booking using database function
    const updatedBooking = await updateBooking(id, body)

    return NextResponse.json({
      success: true,
      data: updatedBooking,
      message: "Booking updated successfully",
    })
  } catch (error) {
    const { id } = await params
    const errorResponse = handleApiError(error, { path: `/api/v1/bookings/${id}`, method: "PATCH" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check if booking exists
    const existingBooking = await getBookingById(id)
    if (!existingBooking) {
      return NextResponse.json({ success: false, error: "Booking not found" }, { status: 404 })
    }

    // Delete booking using database function
    await deleteBooking(id)

    return NextResponse.json({
      success: true,
      message: "Booking deleted successfully",
    })
  } catch (error) {
    const { id } = await params
    const errorResponse = handleApiError(error, { path: `/api/v1/bookings/${id}`, method: "DELETE" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}
