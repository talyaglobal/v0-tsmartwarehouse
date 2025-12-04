import { NextRequest, NextResponse } from "next/server"
import { getNotificationPreferences, upsertNotificationPreferences } from "@/lib/db/notifications"
import { getCurrentUser } from "@/lib/auth/utils"
import { apiWrapper } from "@/lib/middleware/api-wrapper"

export const GET = apiWrapper(async (req: NextRequest) => {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const preferences = await getNotificationPreferences(user.id)
    return NextResponse.json({ preferences })
  } catch (error) {
    console.error("Error fetching notification preferences:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch preferences" },
      { status: 500 }
    )
  }
})

export const PUT = apiWrapper(async (req: NextRequest) => {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    return NextResponse.json({
      success: true,
      preferences,
      message: "Notification preferences updated",
    })
  } catch (error) {
    console.error("Error updating notification preferences:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update preferences" },
      { status: 500 }
    )
  }
})

