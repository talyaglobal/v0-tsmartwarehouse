import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { rejectOnBehalfBooking } from "@/lib/business-logic/bookings"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ApiResponse, ErrorResponse } from "@/types/api"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/v1/bookings/[id]/reject
 * Reject a booking that was created on behalf of the user
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { message } = body

    // Get user's name
    const supabase = await createServerSupabaseClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", authResult.userId)
      .single()

    const approval = await rejectOnBehalfBooking(
      id,
      authResult.userId,
      profile?.name || profile?.email || "Customer",
      message
    )

    const responseData: ApiResponse = {
      success: true,
      data: approval,
      message: "Booking rejected",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, {
      path: "/api/v1/bookings/[id]/reject",
      method: "POST",
    })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
