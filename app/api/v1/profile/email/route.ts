import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ApiResponse } from "@/types/api"

/**
 * PATCH /api/v1/profile/email
 * Update user email (admin / company admin only; no email confirmation required).
 * - Root (platform admin): can change own or any user's email.
 * - Company admin: can change own email or same-company users' emails.
 * Body: { email, userId? }. If userId is omitted, updates the caller's email.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const body = await request.json()
    const { email, userId: bodyUserId } = body
    const targetId = typeof bodyUserId === 'string' && bodyUserId.trim() ? bodyUserId.trim() : user.id

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Valid email is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Resolve permission: root can do anything; company admin can change own or same-company user
    const isRoot = user.role === 'root'
    const callerCompanyId = await getUserCompanyId(user.id)

    if (!isRoot) {
      const targetProfile = await supabase
        .from('profiles')
        .select('id, company_id')
        .eq('id', targetId)
        .maybeSingle()

      if (!targetProfile.data?.id) {
        const errorData: ErrorResponse = {
          success: false,
          error: "User not found",
          statusCode: 404,
        }
        return NextResponse.json(errorData, { status: 404 })
      }

      const targetCompanyId = targetProfile.data.company_id ?? null
      const isOwnEmail = targetId === user.id

      if (isOwnEmail) {
        const canChangeOwn = await isCompanyAdmin(user.id, callerCompanyId ?? undefined)
        if (!canChangeOwn) {
          const errorData: ErrorResponse = {
            success: false,
            error: "Forbidden: Only admins and company admins can change email addresses.",
            statusCode: 403,
          }
          return NextResponse.json(errorData, { status: 403 })
        }
      } else {
        const sameCompany = targetCompanyId !== null && targetCompanyId === callerCompanyId
        const isAdminForTarget = sameCompany && await isCompanyAdmin(user.id, targetCompanyId)
        if (!isAdminForTarget) {
          const errorData: ErrorResponse = {
            success: false,
            error: "Forbidden: You can only change email for users in your company.",
            statusCode: 403,
          }
          return NextResponse.json(errorData, { status: 403 })
        }
      }
    }

    // Check if email is already in use by another user
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .neq('id', targetId)
      .maybeSingle()

    if (existingUser) {
      const errorData: ErrorResponse = {
        success: false,
        error: "This email is already in use",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Server configuration error",
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    const { createClient } = await import('@supabase/supabase-js')
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

    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetId,
      {
        email: email.toLowerCase().trim(),
        email_confirm: true,
      }
    )

    if (updateError) {
      throw new Error(`Failed to update email: ${updateError.message}`)
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from('profiles')
      .update({ email: email.toLowerCase().trim() })
      .eq('id', targetId)
      .select()
      .single()

    if (profileError) {
      console.error('Error updating profile email:', profileError)
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

