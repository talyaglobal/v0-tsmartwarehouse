import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { updateMembershipProgramStatus } from "@/lib/db/membership"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"

/**
 * PUT /api/v1/admin/membership/settings/program
 * Update membership program enabled status (root only)
 */
export async function PUT(request: NextRequest) {
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
        error: 'Unauthorized. Only root users can update membership program status.',
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      const errorData: ErrorResponse = {
        success: false,
        error: 'Invalid request. "enabled" must be a boolean.',
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Update program status
    await updateMembershipProgramStatus(enabled)

    const responseData = {
      success: true,
      message: `Membership program ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: { enabled },
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: 'Failed to update membership program status' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

