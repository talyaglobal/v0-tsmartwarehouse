import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'
import { getBookingById } from '@/lib/db/bookings'
import {
  resolveHostForWarehouse,
  getOrCreateConversation,
  notifyWarehouseSideForNewChat,
} from '@/lib/services/messaging'
import { handleApiError } from '@/lib/utils/logger'
import type { ErrorResponse } from '@/types/api'
import { z } from 'zod'

const bodySchema = z.object({
  bookingId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', statusCode: 401 } satisfies ErrorResponse,
        { status: 401 }
      )
    }

    const body = await request.json()
    const { bookingId } = bodySchema.parse(body)

    const booking = await getBookingById(bookingId)
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found', statusCode: 404 } satisfies ErrorResponse,
        { status: 404 }
      )
    }

    if (booking.customerId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', statusCode: 403 } satisfies ErrorResponse,
        { status: 403 }
      )
    }

    const warehouseId = booking.warehouseId
    const hostId = await resolveHostForWarehouse(warehouseId)
    if (!hostId) {
      return NextResponse.json(
        { success: false, error: 'Warehouse has no assignable host for chat', statusCode: 400 } satisfies ErrorResponse,
        { status: 400 }
      )
    }

    const conversation = await getOrCreateConversation(
      warehouseId,
      hostId,
      user.id,
      bookingId
    )

    await notifyWarehouseSideForNewChat(conversation.id, bookingId, warehouseId)

    return NextResponse.json({
      success: true,
      data: { conversationId: conversation.id, ...conversation },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', statusCode: 400, code: 'VALIDATION_ERROR', details: error.flatten() } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    const err = handleApiError(error, { path: '/api/v1/conversations/start-for-booking' })
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    )
  }
}
