import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'
import { canUserAccessConversation, markMessagesAsRead } from '@/lib/services/messaging'
import { handleApiError } from '@/lib/utils/logger'
import type { ErrorResponse } from '@/types/api'

/**
 * PATCH /api/v1/conversations/[id]/read
 * Mark all messages in the conversation as read for the current user (receiver).
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', statusCode: 401 } satisfies ErrorResponse,
        { status: 401 }
      )
    }

    const { id: conversationId } = await params

    const allowed = await canUserAccessConversation(conversationId, user.id)
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', statusCode: 403 } satisfies ErrorResponse,
        { status: 403 }
      )
    }

    await markMessagesAsRead(conversationId, user.id)

    return NextResponse.json({
      success: true,
      data: { marked: true },
    })
  } catch (error) {
    const err = handleApiError(error, { path: '/api/v1/conversations/[id]/read' })
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    )
  }
}
