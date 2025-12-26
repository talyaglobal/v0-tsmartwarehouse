import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { updateMembershipTierSetting } from "@/lib/db/membership"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { MembershipTier } from "@/types"
import type { ErrorResponse } from "@/types/api"

/**
 * PUT /api/v1/admin/membership/settings/tier/[tierName]
 * Update membership tier settings (root only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tierName: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // Check if user is root
    const supabase = await createServerSupabaseClient()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
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

    // Only root can access
    if (profile.role !== 'root') {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Unauthorized. Only root users can update membership tier settings.',
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const { tierName: tierNameParam } = await params
    const tierName = tierNameParam.toLowerCase() as MembershipTier

    // Validate tier name
    const validTiers: MembershipTier[] = ['bronze', 'silver', 'gold', 'platinum']
    if (!validTiers.includes(tierName)) {
      const errorData: ErrorResponse = {
        success: false,
        error: `Invalid tier name. Must be one of: ${validTiers.join(', ')}`,
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Parse request body
    const body = await request.json()
    const { minSpend, discountPercent, benefits } = body

    // Validate updates
    const updates: {
      minSpend?: number
      discountPercent?: number
      benefits?: string[]
    } = {}

    if (minSpend !== undefined) {
      if (typeof minSpend !== 'number' || minSpend < 0) {
        const errorData: ErrorResponse = {
          success: false,
          error: 'Invalid minSpend. Must be a non-negative number.',
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      updates.minSpend = minSpend
    }

    if (discountPercent !== undefined) {
      if (typeof discountPercent !== 'number' || discountPercent < 0 || discountPercent > 100) {
        const errorData: ErrorResponse = {
          success: false,
          error: 'Invalid discountPercent. Must be a number between 0 and 100.',
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      updates.discountPercent = discountPercent
    }

    if (benefits !== undefined) {
      if (!Array.isArray(benefits) || !benefits.every(b => typeof b === 'string')) {
        const errorData: ErrorResponse = {
          success: false,
          error: 'Invalid benefits. Must be an array of strings.',
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      updates.benefits = benefits
    }

    if (Object.keys(updates).length === 0) {
      const errorData: ErrorResponse = {
        success: false,
        error: 'No valid updates provided. Provide at least one of: minSpend, discountPercent, benefits',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Update tier setting
    const updatedSetting = await updateMembershipTierSetting(tierName, updates)

    const responseData = {
      success: true,
      message: 'Membership tier settings updated successfully',
      data: updatedSetting,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: 'Failed to update membership tier settings' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

