import { type NextRequest, NextResponse } from "next/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ApiResponse } from "@/types/api"

/**
 * POST /api/v1/invitations/[token]/accept
 * Accept an invitation by token
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { password } = body

    if (!token) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Token is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (!password || password.length < 6) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Password must be at least 6 characters",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

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

    // Use admin client for all operations to bypass RLS
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

    const supabaseAuthAdmin = supabaseAdmin // Same client for both auth and database operations

    // Find profile with this invitation token (use admin client to bypass RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        email,
        name,
        role,
        invitation_token,
        invitation_expires_at,
        invited_by,
        company_id,
        status
      `)
      .eq('invitation_token', token)
      .maybeSingle()

    if (profileError || !profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invitation not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check if invitation is expired
    if (profile.invitation_expires_at) {
      const expiresAt = new Date(profile.invitation_expires_at)
      if (expiresAt < new Date()) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Invitation has expired",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
    }

    // Check if invitation is already accepted
    if (profile.company_id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invitation has already been accepted",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Get inviter's company_id (use admin client)
    let companyId: string | null = null
    if (profile.invited_by) {
      const { data: inviter } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', profile.invited_by)
        .maybeSingle()

      if (inviter?.company_id) {
        companyId = inviter.company_id
      }
    }

    if (!companyId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invalid invitation: Company not found",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Update user password in Auth
    try {
      const { error: updatePasswordError } = await supabaseAuthAdmin.auth.admin.updateUserById(
        profile.id,
        { password }
      )

      if (updatePasswordError) {
        console.error('Error updating password:', updatePasswordError)
        // Continue anyway - password might already be set
      }
    } catch (err) {
      console.error('Error updating password:', err)
      // Continue anyway
    }

    // Check if user exists in auth.users, if not create it
    let authUserExists = false
    try {
      const { data: authUser } = await supabaseAuthAdmin.auth.admin.getUserById(profile.id)
      authUserExists = !!authUser?.user
    } catch (err) {
      // User doesn't exist, we'll create it
      authUserExists = false
    }

    // If auth user doesn't exist, create it
    if (!authUserExists) {
      try {
        const { error: createUserError } = await supabaseAuthAdmin.auth.admin.createUser({
          id: profile.id, // Use existing profile ID
          email: profile.email,
          password: password,
          email_confirm: true,
          user_metadata: {
            name: profile.name || profile.email.split('@')[0],
            role: profile.role || 'warehouse_client',
          },
        })

        if (createUserError) {
          console.error('Error creating auth user:', createUserError)
          // Continue anyway - we'll try to update the profile
        } else {
        }
      } catch (createError) {
        console.error('Error creating auth user:', createError)
        // Continue anyway
      }
    }

    // Update profile: set company_id, clear invitation fields, set status = true
    // Status must always be true when invitation is accepted
    const updateData: any = {
      company_id: companyId,
      invitation_token: null,
      invitation_expires_at: null,
      invitation_password: null,
      status: true, // Always set status to true when invitation is accepted
      // Keep invited_by for reference
    }
    // Use admin client to bypass RLS
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', profile.id)

    if (updateError) {
      throw new Error(`Failed to accept invitation: ${updateError.message}`)
    }

    const responseData: ApiResponse<{ email: string }> = {
      success: true,
      data: {
        email: profile.email,
      },
      message: "Invitation accepted successfully",
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
