import { NextRequest, NextResponse } from "next/server"
import { getNotifications, getUnreadCount, markAllNotificationsAsRead } from "@/lib/db/notifications"
import { getCurrentUser } from "@/lib/auth/utils"
import type { NotificationsListResponse, ErrorResponse, ApiResponse } from "@/types/api"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    const errorData: ErrorResponse = {
      success: false,
      error: "Unauthorized",
      statusCode: 401,
    }
    return NextResponse.json(errorData, { status: 401 })
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

    const responseData: NotificationsListResponse = {
      success: true,
      data: notifications,
      total: notifications.length,
      unreadCount,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error fetching notifications:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch notifications",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()

  if (!user) {
    const errorData: ErrorResponse = {
      success: false,
      error: "Unauthorized",
      statusCode: 401,
    }
    return NextResponse.json(errorData, { status: 401 })
  }

  try {
    const { action } = await req.json()

    if (action === "mark_all_read") {
      await markAllNotificationsAsRead(user.id)
      const responseData: ApiResponse = {
        success: true,
        message: "All notifications marked as read",
      }
      return NextResponse.json(responseData)
    }

    const errorData: ErrorResponse = {
      success: false,
      error: "Invalid action",
      statusCode: 400,
    }
    return NextResponse.json(errorData, { status: 400 })
  } catch (error) {
    console.error("Error updating notifications:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update notifications",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}

