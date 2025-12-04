import { NextRequest, NextResponse } from "next/server"
import { getNotifications, getUnreadCount, markAllNotificationsAsRead } from "@/lib/db/notifications"
import { getCurrentUser } from "@/lib/auth/utils"
import { apiWrapper } from "@/lib/middleware/api-wrapper"

export const GET = apiWrapper(async (req: NextRequest) => {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = req.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")
  const read = searchParams.get("read") === "true" ? true : searchParams.get("read") === "false" ? false : undefined
  const type = searchParams.get("type") || undefined

  try {
    const notifications = await getNotifications(user.id, {
      limit,
      offset,
      read,
      type: type as any,
    })

    const unreadCount = await getUnreadCount(user.id)

    return NextResponse.json({
      notifications,
      unreadCount,
      total: notifications.length,
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch notifications" },
      { status: 500 }
    )
  }
})

export const PATCH = apiWrapper(async (req: NextRequest) => {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { action } = await req.json()

    if (action === "mark_all_read") {
      await markAllNotificationsAsRead(user.id)
      return NextResponse.json({ success: true, message: "All notifications marked as read" })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating notifications:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update notifications" },
      { status: 500 }
    )
  }
})

