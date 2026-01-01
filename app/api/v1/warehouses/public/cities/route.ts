import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/warehouses/public/cities
 * Public endpoint to get all unique cities from active warehouses
 * Returns list of cities for autocomplete (no authentication required)
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    // Get all unique cities from active warehouses
    const { data, error } = await supabase
      .from("warehouses")
      .select("city")
      .eq("status", true)
      .order("city", { ascending: true })

    if (error) {
      console.error("[warehouses/public/cities] Query error:", error)
      throw new Error(`Failed to fetch cities: ${error.message}`)
    }

    // Extract unique cities
    const uniqueCities = Array.from(
      new Set((data || []).map((w: any) => w.city).filter(Boolean))
    ).sort()

    const responseData = {
      success: true,
      data: {
        cities: uniqueCities,
      },
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, {
      context: "Failed to fetch cities",
    })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
