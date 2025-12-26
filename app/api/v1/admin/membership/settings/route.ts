import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import { getMembershipProgramStatus } from "@/lib/db/membership"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/admin/membership/settings
 * Get all membership tier settings and program status (root only)
 */
export async function GET(request: NextRequest) {
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
        error: 'Unauthorized. Only root users can access membership settings.',
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Get membership program status
    const programStatus = await getMembershipProgramStatus(false) // Don't use cache for admin view

    const responseData = {
      success: true,
      data: programStatus,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { context: 'Failed to get membership settings' })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
      ...(errorResponse.code && { code: errorResponse.code }),
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

