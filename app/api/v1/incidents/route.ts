import { type NextRequest, NextResponse } from "next/server"
import { mockIncidents } from "@/lib/mock-data"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const severity = searchParams.get("severity")

  let incidents = [...mockIncidents]

  if (status) {
    incidents = incidents.filter((i) => i.status === status)
  }
  if (severity) {
    incidents = incidents.filter((i) => i.severity === severity)
  }

  return NextResponse.json({
    success: true,
    data: incidents,
    total: incidents.length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const newIncident = {
      id: `inc-${Date.now()}`,
      ...body,
      status: "open",
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: newIncident,
      message: "Incident reported successfully",
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
}
