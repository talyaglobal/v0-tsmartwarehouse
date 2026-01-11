import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    const correctPassword = process.env.BETA_PASSWORD

    if (!correctPassword) {
      return NextResponse.json(
        { error: "Beta password not configured" },
        { status: 500 }
      )
    }

    if (password === correctPassword) {
      // Set cookie with 7 days expiry
      const cookieStore = await cookies()
      cookieStore.set("beta-access", "granted", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/"
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: "Incorrect password" },
      { status: 401 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    )
  }
}
