import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ApiResponse } from "@/types/api"
import { acceptInvitation } from "@/features/companies/actions"

/**
 * POST /api/v1/invitations/[token]/accept
 * Accept an invitation by token (called automatically on login if user has pending invitation)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    
    // Get authenticated user
    const supabase = createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Unauthorized",
        statusCode: 401,
      }
      return NextResponse.json(errorData, { status: 401 })
    }

    // Accept invitation using the server action
    const result = await acceptInvitation(token)

    if (!result.success) {
      const errorData: ErrorResponse = {
        success: false,
        error: result.error || "Failed to accept invitation",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const responseData: ApiResponse = {
      success: true,
      data: {
        message: "Invitation accepted successfully",
      },
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/invitations/[token]/accept", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

