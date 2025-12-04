import { NextResponse } from "next/server"
import type { HealthResponse } from "@/types/api"

export async function GET() {
  const responseData: HealthResponse = {
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      services: {
        database: "connected",
        storage: "operational",
      },
    },
  }
  return NextResponse.json(responseData)
}
