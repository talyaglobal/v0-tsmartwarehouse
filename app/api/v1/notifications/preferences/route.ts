import { NextRequest, NextResponse } from "next/server"
import { getNotificationPreferences, upsertNotificationPreferences } from "@/lib/db/notifications"
import { getCurrentUser } from "@/lib/auth/utils"
import { apiWrapper } from "@/lib/middleware/api-wrapper"
import type { ApiResponse, ErrorResponse } from "@/types/api"

export const GET = apiWrapper(async (req: NextRequest) => {
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
    const preferences = await getNotificationPreferences(user.id)
    const responseData: ApiResponse = {
      success: true,
      data: preferences as any,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error fetching notification preferences:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch preferences",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
})

export const PUT = apiWrapper(async (req: NextRequest) => {
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
    const body = await req.json()

    const preferences = await upsertNotificationPreferences({
      userId: user.id,
      emailEnabled: body.emailEnabled,
      smsEnabled: body.smsEnabled,
      pushEnabled: body.pushEnabled,
      whatsappEnabled: body.whatsappEnabled,
      typePreferences: body.typePreferences,
      emailAddress: body.emailAddress,
      phoneNumber: body.phoneNumber,
      whatsappNumber: body.whatsappNumber,
    })

    const responseData: ApiResponse = {
      success: true,
      data: preferences as any,
      message: "Notification preferences updated",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Error updating notification preferences:", error)
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update preferences",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
})

