import { type NextRequest, NextResponse } from "next/server"
import { mockClaims } from "@/lib/mock-data"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get("customerId")
  const status = searchParams.get("status")

  let claims = [...mockClaims]

  if (customerId) {
    claims = claims.filter((c) => c.customerId === customerId)
  }
  if (status) {
    claims = claims.filter((c) => c.status === status)
  }

  return NextResponse.json({
    success: true,
    data: claims,
    total: claims.length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const newClaim = {
      id: `claim-${Date.now()}`,
      ...body,
      status: "submitted",
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: newClaim,
      message: "Claim submitted successfully",
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
}
