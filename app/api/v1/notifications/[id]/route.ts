import { NextRequest, NextResponse } from "next/server"
import { markNotificationAsRead, deleteNotification } from "@/lib/db/notifications"
import { getCurrentUser } from "@/lib/auth/utils"
import { apiWrapper } from "@/lib/middleware/api-wrapper"
import type { NotificationResponse, ErrorResponse, ApiResponse } from "@/types/api"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
      await markNotificationAsRead(id)
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
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
    await deleteNotification(id)
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
}

