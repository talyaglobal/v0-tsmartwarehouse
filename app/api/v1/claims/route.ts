import { type NextRequest, NextResponse } from "next/server"
import { getClaims, createClaim } from "@/lib/db/claims"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import type { ClaimStatus } from "@/types"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get("customerId")
    const status = searchParams.get("status") as ClaimStatus | null

    const filters: {
      customerId?: string
      status?: ClaimStatus
      bookingId?: string
      incidentId?: string
    } = {}

    if (customerId) filters.customerId = customerId
    if (status) filters.status = status

    const claims = await getClaims(filters)

    return NextResponse.json({
      success: true,
      data: claims,
      total: claims.length,
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/claims" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const body = await request.json()

    // Validate required fields
    if (!body.type || !body.description || !body.bookingId || !body.amount) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: type, description, bookingId, and amount" },
        { status: 400 }
      )
    }

    // Get customer profile information
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 404 }
      )
    }

    // Create claim using database function
    const newClaim = await createClaim({
      customerId: user.id,
      customerName: profile.name || user.email,
      ...body,
      status: body.status || "submitted",
    })

    return NextResponse.json({
      success: true,
      data: newClaim,
      message: "Claim submitted successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/claims", method: "POST" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}
