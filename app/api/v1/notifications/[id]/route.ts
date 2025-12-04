import { NextRequest, NextResponse } from "next/server"
import { markNotificationAsRead, deleteNotification } from "@/lib/db/notifications"
import { getCurrentUser } from "@/lib/auth/utils"
import { apiWrapper } from "@/lib/middleware/api-wrapper"

export const PATCH = apiWrapper(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { action } = await req.json()

    if (action === "mark_read") {
      await markNotificationAsRead(params.id)
      return NextResponse.json({ success: true, message: "Notification marked as read" })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating notification:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update notification" },
      { status: 500 }
    )
  }
})

export const DELETE = apiWrapper(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await deleteNotification(params.id)
    return NextResponse.json({ success: true, message: "Notification deleted" })
  } catch (error) {
    console.error("Error deleting notification:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete notification" },
      { status: 500 }
    )
  }
})

