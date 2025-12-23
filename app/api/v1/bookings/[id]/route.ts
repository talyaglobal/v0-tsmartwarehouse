import { type NextRequest, NextResponse } from "next/server"
import { getBookingById, updateBooking, deleteBooking } from "@/lib/db/bookings"
import { handleApiError } from "@/lib/utils/logger"
import type { BookingResponse, ErrorResponse, ApiResponse } from "@/types/api"
import { updateBookingSchema } from "@/lib/validation/schemas"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const booking = await getBookingById(id)

    if (!booking) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Booking not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    const responseData: BookingResponse = {
      success: true,
      data: booking,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: `/api/v1/bookings/${(await params).id}` })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
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

    // Validate request body with Zod schema
    let validatedData
    try {
      validatedData = updateBookingSchema.parse(body)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        const errorData: ErrorResponse = {
          success: false,
          error: "Validation error",
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: zodError.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", "),
        } as ErrorResponse & { details?: string }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    // Update booking using database function
    // Convert null to undefined for hallId to match Booking type
    const updateData = {
      ...validatedData,
      hallId: validatedData.hallId === null ? undefined : validatedData.hallId,
    }
    const updatedBooking = await updateBooking(id, updateData)

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

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check if booking exists
    const existingBooking = await getBookingById(id)
    if (!existingBooking) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Booking not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Delete booking using database function
    await deleteBooking(id)

    const responseData: ApiResponse = {
      success: true,
      message: "Booking deleted successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const { id } = await params
    const errorResponse = handleApiError(error, { path: `/api/v1/bookings/${id}`, method: "DELETE" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}
