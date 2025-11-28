import { NextResponse } from "next/server"
import { openAPISchema } from "@/lib/api/openapi-schema"

// API Documentation endpoint
export async function GET() {
  return NextResponse.json(openAPISchema, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
