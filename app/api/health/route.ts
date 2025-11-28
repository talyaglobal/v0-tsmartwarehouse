import { NextResponse } from "next/server"

// Health check endpoint for monitoring and load balancers
export async function GET() {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    checks: {
      api: "operational",
      // Add database, cache, and other service checks here
    },
  }

  return NextResponse.json(health, {
    headers: {
      "Cache-Control": "no-store",
    },
  })
}
