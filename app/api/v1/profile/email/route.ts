import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ApiResponse } from "@/types/api"

/**
 * PATCH /api/v1/profile/email
 * Update user email (admin/owner only, no email confirmation required)
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Valid email is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Check if user is owner (only owners can change email)
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'owner') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Forbidden: Only company owners can change email addresses.",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Check if email is already in use
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .neq('id', user.id)
      .maybeSingle()

    if (existingUser) {
      const errorData: ErrorResponse = {
        success: false,
        error: "This email is already in use",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Update email using admin API (no confirmation required)
    // We need to use service role key for admin operations
    const { createClient } = await import('@supabase/supabase-js')
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!serviceRoleKey) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Server configuration error",
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Update user email in auth (no confirmation required)
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        email: email.toLowerCase().trim(),
        email_confirm: true, // Auto-confirm email
      }
    )

    if (updateError) {
      throw new Error(`Failed to update email: ${updateError.message}`)
    }

    // Update email in profiles table
    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update({ email: email.toLowerCase().trim() })
      .eq('id', user.id)
      .select()
      .single()

    if (profileError) {
      console.error('Error updating profile email:', profileError)
      // Don't fail if profile update fails, auth update succeeded
    }

    const responseData: ApiResponse = {
      success: true,
      data: {
        email: updatedUser.user.email,
        profile: updatedProfile,
      },
      message: "Email updated successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/profile/email", method: "PATCH" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

