import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/utils'
import {
  getUserConversations,
  getConversationsForWarehouseUser,
} from '@/lib/services/messaging'
import { handleApiError } from '@/lib/utils/logger'
import type { ErrorResponse } from '@/types/api'

/**
 * GET /api/v1/conversations
 * Returns conversations for the current user:
 * - As client: conversations where user is guest (or host)
 * - As warehouse: conversations for warehouses the user can access (staff/admin)
 * Merges both lists and deduplicates by id.
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', statusCode: 401 } satisfies ErrorResponse,
        { status: 401 }
      )
    }

    const [asUser, asWarehouse] = await Promise.all([
      getUserConversations(user.id),
      getConversationsForWarehouseUser(user.id),
    ])

    const byId = new Map(asUser.map((c) => [c.id, c]))
    asWarehouse.forEach((c) => {
      if (!byId.has(c.id)) byId.set(c.id, c)
    })

    const conversations = Array.from(byId.values()).sort(
      (a, b) =>
        new Date(b.last_message_at ?? b.created_at).getTime() -
        new Date(a.last_message_at ?? a.created_at).getTime()
    )

    return NextResponse.json({
      success: true,
      data: conversations,
    })
  } catch (error) {
    const err = handleApiError(error, { path: '/api/v1/conversations' })
    return NextResponse.json(
      { success: false, error: err.message, statusCode: err.statusCode } satisfies ErrorResponse,
      { status: err.statusCode }
    )
  }
}
