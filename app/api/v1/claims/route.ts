import { type NextRequest, NextResponse } from "next/server"
import { getClaims, createClaim } from "@/lib/db/claims"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import { createClaimSchema } from "@/lib/validation/schemas"
import type { ClaimStatus } from "@/types"
import type { ClaimsListResponse, ClaimResponse, ErrorResponse } from "@/types/api"

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") as ClaimStatus | null

    // Check if user is company admin
    const userCompanyId = await getUserCompanyId(user.id)
    const isCompanyAdminUser = userCompanyId ? await isCompanyAdmin(user.id, userCompanyId) : false

    const filters: {
      customerId?: string
      companyId?: string
      status?: ClaimStatus
      bookingId?: string
      incidentId?: string
    } = {}

    // System admin users can see all claims (or filter by customerId if provided)
    if (user.role === 'root') {
      const customerId = searchParams.get("customerId")
      if (customerId) {
        filters.customerId = customerId
      }
      // If no customerId provided, admin sees all claims
    } else if (isCompanyAdminUser && userCompanyId) {
      // Company admin - show all claims from their company
      filters.companyId = userCompanyId
    } else {
      // Regular users can only see their own claims
      filters.customerId = user.id
    }

    if (status) filters.status = status

    const claims = await getClaims(filters)

    const responseData: ClaimsListResponse = {
      success: true,
      data: claims,
      total: claims.length,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/claims" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
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

    // Validate with Zod schema
    let validatedData
    try {
      validatedData = createClaimSchema.parse(body)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Validation error",
          statusCode: 400,
          code: "VALIDATION_ERROR",
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
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
      const errorData: ErrorResponse = {
        success: false,
        error: "User profile not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Create claim using database function
    const newClaim = await createClaim({
      customerId: user.id,
      customerName: profile.name || user.email,
      ...validatedData,
      status: "submitted",
    })

    const responseData: ClaimResponse = {
      success: true,
      data: newClaim,
      message: "Claim submitted successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/claims", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
