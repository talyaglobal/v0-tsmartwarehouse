import { type NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'
import {
  canUserAccessConversation,
  getConversationMessages,
  sendMessage,
} from '@/lib/services/messaging'
import { handleApiError } from '@/lib/utils/logger'
import type { ErrorResponse } from '@/types/api'
import { z } from 'zod'

const postBodySchema = z.object({
  content: z.string().min(1).max(10000),
})

export async function GET(
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

    const url = new URL(_request.url)
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
    const offset = Number(url.searchParams.get('offset')) || 0

    const result = await getConversationMessages(conversationId, limit, offset)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const err = handleApiError(error, { path: '/api/v1/conversations/[id]/messages' })
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    )
  }
}

export async function POST(
  request: NextRequest,
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

    const body = await request.json()
    const { content } = postBodySchema.parse(body)

    const message = await sendMessage(conversationId, user.id, content)

    return NextResponse.json({
      success: true,
      data: message,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', statusCode: 400, code: 'VALIDATION_ERROR', details: error.flatten() } satisfies ErrorResponse,
        { status: 400 }
      )
    }
    const err = handleApiError(error, { path: '/api/v1/conversations/[id]/messages' })
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    )
  }
}
