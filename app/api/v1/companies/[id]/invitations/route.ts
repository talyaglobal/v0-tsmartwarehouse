import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ListResponse, ApiResponse } from "@/types/api"
import { randomBytes } from "crypto"
import { sendEmail } from "@/lib/email/nodemailer"
import { getSiteUrlFromRequest } from "@/lib/utils/site-url"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult
    const { id: companyId } = await params

    // Check if user has permission
    if (user.role !== 'admin') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (userCompanyId !== companyId) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: You don't have permission to view this company's invitations",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
      
      const isAdmin = await isCompanyAdmin(user.id, companyId)
      if (!isAdmin) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: Only company admins can view company invitations",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    }

    const supabaseAdmin = createServerSupabaseClient()
    
    // Fetch pending invitations from profiles table
    // Simple rule: Show invitation ONLY if:
    // 1. invitation_token is NOT null (has active invitation - not accepted yet)
    // 2. invitation is not expired
    // 3. company_id IS NULL (not yet accepted - once accepted, company_id will be set)
    // 4. invited_by user's company_id matches the requested company
    // Since self-join doesn't work well, we'll fetch all pending invitations first,
    // then fetch inviter profiles separately and filter
    const { data: allPendingInvitations, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        email,
        name,
        invitation_token,
        invitation_expires_at,
        company_id,
        role,
        invited_by,
        created_at
      `)
      .not('invitation_token', 'is', null) // Must have an active token
      .gt('invitation_expires_at', new Date().toISOString()) // Must not be expired
      .is('company_id', null) // Must not have company_id set (not accepted yet)
      .order('created_at', { ascending: false })

    if (fetchError) {
      throw new Error(`Failed to fetch invitations: ${fetchError.message}`)
    }

    if (!allPendingInvitations || allPendingInvitations.length === 0) {
      const responseData: ListResponse<any> = {
        success: true,
        data: [],
        total: 0,
      }
      return NextResponse.json(responseData)
    }

    // Get unique inviter IDs
    const inviterIds = [...new Set(allPendingInvitations.map((inv: any) => inv.invited_by).filter(Boolean))]
    
    // Fetch inviter profiles to get their company_id
    const { data: inviters, error: invitersError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id')
      .in('id', inviterIds)

    if (invitersError) {
      throw new Error(`Failed to fetch inviters: ${invitersError.message}`)
    }

    // Create a map of inviter_id -> company_id for quick lookup
    const inviterCompanyMap = new Map<string, string>()
    inviters?.forEach((inviter: any) => {
      if (inviter.company_id) {
        inviterCompanyMap.set(inviter.id, inviter.company_id)
      }
    })

    // Filter invitations where inviter's company matches the requested company
    const profiles = allPendingInvitations.filter((inv: any) => {
      if (!inv.invited_by) return false
      const inviterCompanyId = inviterCompanyMap.get(inv.invited_by)
      return inviterCompanyId === companyId
    })

    // Transform profiles to invitation format
    const invitations = (profiles || []).map((profile: any) => ({
      id: profile.id,
      company_id: companyId, // Use the requested companyId (from inviter)
      email: profile.email,
      role: profile.role || 'member', // Use profile role (will be set when invitation is accepted)
      token: profile.invitation_token,
      expires_at: profile.invitation_expires_at,
      created_at: profile.created_at,
      profiles: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
      },
    }))

    const responseData: ListResponse<any> = {
      success: true,
      data: invitations,
      total: invitations.length,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/companies/[id]/invitations", method: "GET" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult
    const { id: companyId } = await params
    const body = await request.json()
    const { email, fullName, role = 'member' } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Valid email is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Full name is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (!['owner', 'admin', 'member'].includes(role)) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invalid role. Must be 'owner', 'admin', or 'member'",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Check if user has permission
    if (user.role !== 'admin') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (userCompanyId !== companyId) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: You don't have permission to invite members to this company",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
      
      const isAdmin = await isCompanyAdmin(user.id, companyId)
      if (!isAdmin) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: Only company admins can invite members",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    }

    const supabase = createServerSupabaseClient()
    const supabaseAdmin = createServerSupabaseClient()
    
    // Check if user with this email exists in profiles table
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, company_id, invitation_token, invitation_expires_at, role')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()
    
    // Check if user exists in Supabase Auth (even if not in profiles)
    let existingAuthUser: { id: string } | null = null
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

    const supabaseAuthAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Try to get user by email from Auth using listUsers with pagination
    // Note: Supabase Admin API doesn't have a direct getUserByEmail method,
    // so we need to list users and filter. For efficiency, we only fetch first page.
    try {
      const { data: authUsers, error: listError } = await supabaseAuthAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // Max per page
      })
      if (!listError && authUsers?.users) {
        const authUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase().trim())
        if (authUser) {
          existingAuthUser = { id: authUser.id }
        }
      }
    } catch (error) {
      console.error('Error checking auth users:', error)
      // Continue, we'll handle this case below
      // If listing fails, we'll try to create user and handle the error if user already exists
    }

    // Check if user is already a member (if profile exists)
    if (existingProfile && existingProfile.company_id === companyId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "User is already a member of this company",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Check if there's already a pending invitation
    if (existingProfile && existingProfile.invitation_token && existingProfile.company_id === companyId) {
      const expiresAt = existingProfile.invitation_expires_at ? new Date(existingProfile.invitation_expires_at) : null
      if (expiresAt && expiresAt > new Date()) {
        const errorData: ErrorResponse = {
          success: false,
          error: "An active invitation already exists for this email",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
    }

    // Generate unique token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

    // If user doesn't exist in Auth, create user with generated password
    let generatedPassword: string | null = null
    let createdUserId: string | null = null

    if (!existingAuthUser && !existingProfile) {
      // Generate a secure random password
      generatedPassword = randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 12) + 'A1!'

      // Create user with generated password
      const { data: newUser, error: createUserError } = await supabaseAuthAdmin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: generatedPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: fullName.trim(),
          role: 'customer', // Default role
        },
      })

      if (createUserError) {
        console.error('Error creating user:', createUserError)
        const errorData: ErrorResponse = {
          success: false,
          error: `Failed to create user account: ${createUserError.message}`,
          statusCode: 500,
        }
        return NextResponse.json(errorData, { status: 500 })
      }

      createdUserId = newUser.user.id

      // Wait a moment for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 500))

      // Check if profile exists (created by trigger) and update it with invitation data
      const { data: profileAfterCreate, error: profileCheckError } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email')
        .eq('id', createdUserId)
        .maybeSingle()

      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        console.error('Error checking profile:', profileCheckError)
      }

      if (profileAfterCreate) {
        // Profile exists (created by trigger), update it with invitation token, role, and password
        // Store role in profile (will be used when invitation is accepted)
        // Store password temporarily for auto-login (will be cleared when invitation is accepted)
        // DO NOT set company_id yet - it will be set when invitation is accepted
        const profileRole = role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : 'customer'
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            name: fullName.trim(), // Set name from invitation
            email: email.toLowerCase().trim(),
            role: profileRole, // Store role from invitation (will be used when accepted)
            invitation_token: token,
            invitation_expires_at: expiresAt.toISOString(),
            invitation_password: generatedPassword, // Store password temporarily for auto-login
            invited_by: user.id,
            // Do NOT set company_id - it will be set when invitation is accepted
          })
          .eq('id', createdUserId)

        if (profileUpdateError) {
          console.error('Error updating profile with invitation:', profileUpdateError)
          const errorData: ErrorResponse = {
            success: false,
            error: `Failed to create invitation: ${profileUpdateError.message}`,
            statusCode: 500,
          }
          return NextResponse.json(errorData, { status: 500 })
        }
        console.log('✅ Profile updated with invitation token')
      } else {
        // Profile doesn't exist, create it with invitation token, role, and password (no company_id)
        const profileRole = role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : 'customer'
        const { error: profileCreateError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: createdUserId,
            email: email.toLowerCase().trim(),
            name: fullName.trim(),
            role: profileRole, // Store role from invitation (will be used when accepted)
            // DO NOT set company_id - it will be set when invitation is accepted
            invitation_token: token,
            invitation_expires_at: expiresAt.toISOString(),
            invitation_password: generatedPassword, // Store password temporarily for auto-login
            invited_by: user.id,
          })

        if (profileCreateError) {
          console.error('Error creating profile with invitation:', profileCreateError)
          const errorData: ErrorResponse = {
            success: false,
            error: `Failed to create invitation: ${profileCreateError.message}`,
            statusCode: 500,
          }
          return NextResponse.json(errorData, { status: 500 })
        }
        console.log('✅ Profile created with invitation token')
      }
    } else if (existingAuthUser && !existingProfile) {
      // User exists in Auth but not in profiles - create profile with invitation token, role, and password
      const profileRole = role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : 'customer'
      // Note: For existing Auth users, we don't have the generated password, so invitation_password will be NULL
      // They can still login with their existing password or use the invitation link
      const { error: profileCreateError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: existingAuthUser.id,
          email: email.toLowerCase().trim(),
          name: fullName.trim(),
          role: profileRole, // Store role from invitation (will be used when accepted)
          // DO NOT set company_id - it will be set when invitation is accepted
          invitation_token: token,
          invitation_expires_at: expiresAt.toISOString(),
          invitation_password: null, // Existing Auth user already has password
          invited_by: user.id,
        })

      if (profileCreateError) {
        console.error('Error creating profile for existing auth user:', profileCreateError)
        const errorData: ErrorResponse = {
          success: false,
          error: `Failed to create invitation: ${profileCreateError.message}`,
          statusCode: 500,
        }
        return NextResponse.json(errorData, { status: 500 })
      }
      console.log('✅ Profile created for existing auth user with invitation token')
    } else if (existingProfile) {
      // User exists in profiles, update with invitation token, role, and password (if new user was created)
      const profileRole = role === 'owner' ? 'owner' : role === 'admin' ? 'admin' : 'customer'
      const updateData: any = {
        role: profileRole, // Update role from invitation (will be used when accepted)
        invitation_token: token,
        invitation_expires_at: expiresAt.toISOString(),
        invited_by: user.id,
        // Do NOT update company_id - it will be set when invitation is accepted
      }
      
      // If we generated a password for a new user, store it temporarily
      if (generatedPassword) {
        updateData.invitation_password = generatedPassword
      }
      
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', existingProfile.id)

      if (updateError) {
        console.error('Error updating existing profile with invitation:', updateError)
        const errorData: ErrorResponse = {
          success: false,
          error: `Failed to create invitation: ${updateError.message}`,
          statusCode: 500,
        }
        return NextResponse.json(errorData, { status: 500 })
      }
      console.log('✅ Existing profile updated with invitation token')
    }

    // Get company and inviter information for email
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    const { data: inviter } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    // Send invitation email
    const siteUrl = getSiteUrlFromRequest(request)
    const acceptUrl = `${siteUrl}/accept-invitation/${token}`
    
    // Determine if user exists - if not, send welcome email
    const isNewUser = !existingProfile
    const templateName = isNewUser ? 'welcome-invitation' : 'team-invitation'
    
    // Import email template function
    const { getEmailTemplate } = await import('@/lib/notifications/templates/email')
    const template = getEmailTemplate(templateName)

    let emailResult: { success: boolean; error?: string } | null = null

    if (template) {
      const invitedName = fullName.trim() || email.split('@')[0]
      const templateData = {
        invitedName,
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        companyName: company?.name || 'Company',
        role,
        invitedBy: inviter?.name || 'Admin',
        expiresAt: expiresAt.toLocaleDateString(),
        token,
        acceptUrl,
        password: generatedPassword, // Include password in email for new users
      }

      const html = template.html(templateData)
      const subject = typeof template.subject === 'function' 
        ? template.subject(templateData)
        : template.subject

      // Send email
      emailResult = await sendEmail({
        to: email.toLowerCase().trim(),
        subject,
        html,
        text: template.text ? template.text(templateData) : html.replace(/<[^>]*>/g, ''),
      })

      if (!emailResult.success) {
        console.error('Failed to send invitation email:', emailResult.error)
      } else {
        console.log('✅ Invitation email sent successfully')
      }
    }

    // Check if email was sent successfully
    const emailSent = template ? (emailResult?.success ?? false) : false
    
    const responseData: ApiResponse = {
      success: true,
      data: {
        id: existingProfile?.id || createdUserId || '',
        company_id: companyId,
        email: email.toLowerCase().trim(),
        role,
        token,
        expires_at: expiresAt.toISOString(),
        emailSent,
      },
      message: emailSent 
        ? "Invitation sent successfully" 
        : "Invitation created but email could not be sent. Please check SMTP configuration.",
    }
    
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/companies/[id]/invitations", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
