import { NextRequest, NextResponse } from "next/server"
import { markNotificationAsRead, deleteNotification } from "@/lib/db/notifications"
import { getCurrentUser } from "@/lib/auth/utils"
import { apiWrapper } from "@/lib/middleware/api-wrapper"
import type { NotificationResponse, ErrorResponse, ApiResponse } from "@/types/api"

export const PATCH = apiWrapper(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
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

    if (action === "mark_read") {
      await markNotificationAsRead(params.id)
      const responseData: ApiResponse = {
        success: true,
        message: "Notification marked as read",
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
    console.error("Error updating notification:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update notification",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
})

export const DELETE = apiWrapper(async (
  req: NextRequest,
  { params }: { params: { id: string } }
) => {
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
    await deleteNotification(params.id)
    const responseData: ApiResponse = {
      success: true,
      message: "Notification deleted",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error deleting notification:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete notification",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
})

