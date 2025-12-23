import { type NextRequest, NextResponse } from "next/server"
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import type { ApiResponse, ErrorResponse } from "@/types/api"
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const body = await request.json()
    const { currentPassword, newPassword, confirmPassword } = body

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      const errorData: ErrorResponse = {
        success: false,
        error: "All password fields are required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (newPassword !== confirmPassword) {
      const errorData: ErrorResponse = {
        success: false,
        error: "New passwords don't match",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (newPassword.length < 6) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Password must be at least 6 characters",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (currentPassword === newPassword) {
      const errorData: ErrorResponse = {
        success: false,
        error: "New password must be different from current password",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Get the current authenticated supabase client (preserves session)
    const supabase = await createAuthenticatedSupabaseClient()
    
    // Verify current password by attempting to sign in with a separate client instance
    // This won't affect the current authenticated session
    const verifyClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
    
    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Current password is incorrect",
        statusCode: 401,
      }
      return NextResponse.json(errorData, { status: 401 })
    }

    // Sign out from the verify client to clean up
    await verifyClient.auth.signOut()

    // If current password is correct, update to new password using the original authenticated session
    // The supabase client still has the original session from cookies
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      const errorData: ErrorResponse = {
        success: false,
        error: updateError.message || "Failed to update password",
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    const responseData: ApiResponse = {
      success: true,
      message: "Password updated successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/auth/change-password", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

