import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getInvoices } from "@/lib/db/invoices"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { calculateMembershipTierFromSpend, getMembershipTierInfoFromSpend } from "@/lib/business-logic/membership"
import { isMembershipProgramEnabled } from "@/lib/business-logic/membership"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/membership
 * Get current user's membership information
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const supabase = await createServerSupabaseClient()

    // Get user profile for credit balance and member since date
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credit_balance, created_at, name, email')
      .eq('id', user.id)
      .eq('status', true) // Soft delete filter
      .single()

    if (profileError || !profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Profile not found',
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Get total spend from paid invoices
    const invoices = await getInvoices({
      customerId: user.id,
      status: 'paid', // invoice_status = 'paid'
      useCache: false, // Don't use cache for real-time membership data
    })

    const totalSpend = invoices.reduce((sum, invoice) => sum + invoice.total, 0)
    const creditBalance = parseFloat(profile.credit_balance?.toString() || '0')
    const memberSince = profile.created_at

    // Check if membership program is enabled
    const programEnabled = await isMembershipProgramEnabled()

    // Calculate membership tier from total spend
    const tier = await calculateMembershipTierFromSpend(totalSpend)
    
    // Get tier info with next tier details
    const tierInfo = await getMembershipTierInfoFromSpend(totalSpend)

    // Build response
    const responseData = {
      success: true,
      data: {
        tier,
        tierName: tierInfo.name,
        totalSpend,
        creditBalance,
        memberSince,
        programEnabled,
        benefits: tierInfo.benefits,
        discount: tierInfo.discount,
        minSpend: tierInfo.minSpend, // Current tier's minimum spend
        nextTier: tierInfo.nextTier ? {
          tier: tierInfo.nextTier.tier,
          name: tierInfo.nextTier.name,
          minSpend: tierInfo.nextTier.minSpend,
          spendNeeded: tierInfo.nextTier.spendNeeded,
        } : undefined,
      },
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: 'Failed to get membership data' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

