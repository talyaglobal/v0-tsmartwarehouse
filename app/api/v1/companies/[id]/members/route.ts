import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ListResponse } from "@/types/api"
import { sendEmail } from "@/lib/email/nodemailer"
import { getEmailTemplate } from "@/lib/notifications/templates/email"
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

    // Check if user has permission to view company members
    // Root users can view any company's members
    if (user.role !== 'root') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (userCompanyId !== companyId) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: You don't have permission to view this company's members",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
      
      const isAdmin = await isCompanyAdmin(user.id, companyId)
      if (!isAdmin) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: Only company admins can view company members",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    }

    // Use admin client to bypass RLS for company admin operations
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
    
    console.log(`[GET /api/v1/companies/${companyId}/members] Fetching members for company:`, companyId)
    console.log(`[GET /api/v1/companies/${companyId}/members] User role:`, user.role)
    console.log(`[GET /api/v1/companies/${companyId}/members] User ID:`, user.id)
    
    // Get members from profiles table (company_members removed)
    // Include all roles - show all users with status = true for this company
    // Use admin client to bypass RLS since we've already verified permissions
    const { data: members, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        company_id,
        email,
        name,
        role,
        avatar_url,
        phone,
        invited_by,
        membership_tier,
        credit_balance,
        status,
        created_at,
        updated_at
      `)
      .eq('company_id', companyId)
      .eq('status', true) // Only show active (non-deleted) members
      .not('role', 'is', null) // Exclude profiles without role
      .order('created_at', { ascending: false })

    if (error) {
      console.error(`[GET /api/v1/companies/${companyId}/members] Error:`, error)
      throw new Error(`Failed to fetch company members: ${error.message}`)
    }

    console.log(`[GET /api/v1/companies/${companyId}/members] Found ${members?.length || 0} members`)
    if (members && members.length > 0) {
      console.log(`[GET /api/v1/companies/${companyId}/members] Sample member:`, {
        id: members[0].id,
        email: members[0].email,
        name: members[0].name,
        role: members[0].role,
        company_id: members[0].company_id,
        status: (members[0] as any).status,
      })
    }

    const responseData: ListResponse<any> = {
      success: true,
      data: members || [],
      total: members?.length || 0,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/companies/[id]/members", method: "GET" })
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

    // Check permissions - only company admins can add members directly
    if (user.role !== 'root') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (userCompanyId !== companyId) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: You don't have permission to add members to this company",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
      
      const isAdmin = await isCompanyAdmin(user.id, companyId)
      if (!isAdmin) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: Only company admins can add members directly",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    }

    const body = await request.json()
    const { email, fullName, role, password } = body

    // Validate required fields
    if (!email || !fullName || !role || !password) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Missing required fields: email, fullName, role, and password are required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invalid email format",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Validate role - only warehouse_supervisor and warehouse_staff are allowed for team members
    const validRoles = ['warehouse_supervisor', 'warehouse_staff']
    if (!validRoles.includes(role)) {
      const errorData: ErrorResponse = {
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Use admin client to bypass RLS
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get current user's storage_interest to inherit it
    const { data: currentUserProfile } = await supabaseAdmin
      .from('profiles')
      .select('storage_interest')
      .eq('id', user.id)
      .maybeSingle()

    const storageInterest = currentUserProfile?.storage_interest || null

    // Get company name for welcome email
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .maybeSingle()

    // First check if profile exists with this email and company_id
    const normalizedEmail = email.toLowerCase().trim()
    const { data: existingProfileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id, status, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    // If profile exists and is already in this company and active, reject
    if (existingProfileByEmail) {
      if (existingProfileByEmail.company_id === companyId && existingProfileByEmail.status === true) {
        const errorData: ErrorResponse = {
          success: false,
          error: "User is already a member of this company",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      if (existingProfileByEmail.company_id === companyId && existingProfileByEmail.status === false) {
        // User was previously in this company but deleted, we'll reactivate them
        // Continue to the reactivation logic below
      } else if (existingProfileByEmail.company_id && existingProfileByEmail.company_id !== companyId) {
        const errorData: ErrorResponse = {
          success: false,
          error: "This user is already a member of another company",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
    }

    // Check if user exists in auth by listing users (with pagination support)
    // Note: listUsers() may not return all users if there are many, but we'll try to find the user
    let existingAuthUser = null
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (!listError && existingUsers?.users) {
      existingAuthUser = existingUsers.users.find(u => u.email?.toLowerCase() === normalizedEmail)
    }
    
    // If profile exists but no auth user found, it's an orphaned profile - we'll create a new auth user
    // If auth user exists but profile doesn't match email, we'll handle it in the logic below

    let userId: string
    let message: string

    if (existingAuthUser) {
      // User exists in auth
      userId = existingAuthUser.id
      
      if (existingProfileByEmail && existingProfileByEmail.id === userId) {
        // Profile exists for this auth user
        if (existingProfileByEmail.company_id === companyId && existingProfileByEmail.status === false) {
          // Reactivate user in the same company
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ 
              status: true, 
              role: role, 
              name: fullName.trim(), 
              updated_at: new Date().toISOString(),
              storage_interest: storageInterest 
            })
            .eq('id', userId)

          if (updateError) {
            console.error('Error reactivating profile:', updateError)
            const errorData: ErrorResponse = {
              success: false,
              error: `Failed to reactivate user: ${updateError.message}`,
              statusCode: 500,
            }
            return NextResponse.json(errorData, { status: 500 })
          }
          message = "User reactivated and added to company."
        } else {
          // Update profile to add to company (user exists but not in this company)
          const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update({
              company_id: companyId,
              name: fullName.trim(),
              role: role,
              status: true,
              invited_by: user.id,
              storage_interest: storageInterest,
            })
            .eq('id', userId)

          if (profileUpdateError) {
            console.error('Error updating profile:', profileUpdateError)
            const errorData: ErrorResponse = {
              success: false,
              error: `Failed to update user profile: ${profileUpdateError.message}`,
              statusCode: 500,
            }
            return NextResponse.json(errorData, { status: 500 })
          }
          message = "Existing user added to company successfully."
        }
      } else if (existingProfileByEmail && existingProfileByEmail.id !== userId) {
        // Profile exists but for a different auth user (shouldn't happen, but handle it)
        const errorData: ErrorResponse = {
          success: false,
          error: "Email conflict: Profile exists for a different user",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      } else {
        // Auth user exists but no profile - create/update profile
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({
            company_id: companyId,
            name: fullName.trim(),
            role: role,
            status: true,
            invited_by: user.id,
            storage_interest: storageInterest,
            email: normalizedEmail,
          })
          .eq('id', userId)

        if (profileUpdateError) {
          // If update fails, try insert
          const { error: profileInsertError } = await supabaseAdmin
            .from('profiles')
            .insert({
              id: userId,
              email: normalizedEmail,
              company_id: companyId,
              name: fullName.trim(),
              role: role,
              status: true,
              invited_by: user.id,
              storage_interest: storageInterest,
            })

          if (profileInsertError) {
            console.error('Error creating profile:', profileInsertError)
            const errorData: ErrorResponse = {
              success: false,
              error: `Failed to create user profile: ${profileInsertError.message}`,
              statusCode: 500,
            }
            return NextResponse.json(errorData, { status: 500 })
          }
        }
        message = "Existing user added to company successfully."
      }

      // Update auth user metadata
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          name: fullName.trim(),
          role: 'warehouse_client', // Keep as customer in metadata for compatibility
        },
      })
    } else {
      // Create new user in auth
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: fullName.trim(),
          role: 'warehouse_client', // Default role in metadata
        },
      })

      if (createUserError) {
        console.error('Error creating user:', createUserError)
        const errorData: ErrorResponse = {
          success: false,
          error: `Failed to create user: ${createUserError.message}`,
          statusCode: 500,
        }
        return NextResponse.json(errorData, { status: 500 })
      }

      userId = newUser.user.id
      message = "New user created and added to company successfully."

      // Wait for trigger to create profile (give it more time)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Check if profile exists, if not create it manually
      const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        console.error('Error checking profile:', profileCheckError)
      }

      if (!existingProfile) {
        // Profile doesn't exist, create it manually
        console.log('Profile not found after trigger, creating manually...')
        const { error: profileInsertError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            email: normalizedEmail,
            company_id: companyId,
            name: fullName.trim(),
            role: role,
            status: true,
            invited_by: user.id,
            storage_interest: storageInterest,
          })

        if (profileInsertError) {
          console.error('Error inserting profile:', profileInsertError)
          const errorData: ErrorResponse = {
            success: false,
            error: `Failed to create user profile: ${profileInsertError.message}`,
            statusCode: 500,
          }
          return NextResponse.json(errorData, { status: 500 })
        }
      } else {
        // Profile exists, update it with company info
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({
            company_id: companyId,
            name: fullName.trim(),
            role: role,
            status: true,
            invited_by: user.id,
            storage_interest: storageInterest,
            email: normalizedEmail,
          })
          .eq('id', userId)

        if (profileUpdateError) {
          console.error('Error updating profile after creation:', profileUpdateError)
          const errorData: ErrorResponse = {
            success: false,
            error: `Failed to update user profile: ${profileUpdateError.message}`,
            statusCode: 500,
          }
          return NextResponse.json(errorData, { status: 500 })
        }
      }
    }

    // Get the created/updated member data with retry logic
    let member = null
    let memberFetchError = null
    
    // Retry up to 3 times with increasing delays
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt))
      }
      
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, name, role, company_id, created_at')
        .eq('id', userId)
        .single()
      
      if (!error && data) {
        member = data
        memberFetchError = null
        break
      }
      
      memberFetchError = error
    }

    // If still no member, construct it manually from the data we have
    if (!member) {
      console.warn('Could not fetch member, constructing manually. Error:', memberFetchError)
      member = {
        id: userId,
        email: email.toLowerCase().trim(),
        name: fullName.trim(),
        role: role,
        company_id: companyId,
        created_at: new Date().toISOString(),
      }
    }

    // Send welcome email only to newly created users (not existing users)
    let emailSent = false
    let emailError: string | null = null
    
    if (!existingAuthUser) {
      try {
        console.log(`[POST /api/v1/companies/${companyId}/members] Attempting to send welcome email to: ${email}`)
        
        const template = getEmailTemplate("welcome-member")
        if (!template) {
          emailError = 'Welcome email template not found'
          console.error(`[POST /api/v1/companies/${companyId}/members] ❌ ${emailError}`)
        } else {
          const siteUrl = getSiteUrlFromRequest(request)
          const templateData = {
            email: email.toLowerCase().trim(),
            fullName: fullName.trim(),
            password: password,
            role: role,
            companyName: company?.name || 'Warebnb',
            dashboardUrl: `${siteUrl}/login`,
          }
          
          const subject = typeof template.subject === "function" 
            ? template.subject(templateData) 
            : template.subject
          const html = template.html(templateData)
          const text = template.text ? template.text(templateData) : html.replace(/<[^>]*>/g, '')

          console.log(`[POST /api/v1/companies/${companyId}/members] 📤 Sending welcome email to: ${email}`)
          console.log(`[POST /api/v1/companies/${companyId}/members] Subject: ${subject}`)
          
          const emailResult = await sendEmail({
            to: email.toLowerCase().trim(),
            subject,
            html,
            text,
          })
          
          if (emailResult.success) {
            emailSent = true
            console.log(`[POST /api/v1/companies/${companyId}/members] ✅ Welcome email sent successfully to ${email}`)
          } else {
            emailError = emailResult.error || 'Unknown email error'
            console.error(`[POST /api/v1/companies/${companyId}/members] ❌ Failed to send welcome email: ${emailError}`)
          }
        }
      } catch (emailErrorException) {
        emailError = emailErrorException instanceof Error ? emailErrorException.message : 'Unknown error'
        console.error(`[POST /api/v1/companies/${companyId}/members] ❌ Exception sending welcome email:`, emailErrorException)
      }
    }

    const responseData = {
      success: true,
      data: {
        ...member,
        message: message,
        emailSent: emailSent,
        emailError: emailError || undefined,
      },
    }

    // Log final status and verify profile exists
    console.log(`[POST /api/v1/companies/${companyId}/members] ✅ Member created/updated successfully:`, {
      userId,
      email,
      role,
      companyId,
      emailSent,
      emailError: emailError || null,
    })

    // Final verification: Check if profile exists and is visible in GET query
    const { data: verifyProfile, error: verifyError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, name, role, company_id, status')
      .eq('id', userId)
      .eq('company_id', companyId)
      .eq('status', true)
      .maybeSingle()

    if (verifyError) {
      console.error(`[POST /api/v1/companies/${companyId}/members] ⚠️ Verification query error:`, verifyError)
    } else if (!verifyProfile) {
      console.error(`[POST /api/v1/companies/${companyId}/members] ⚠️ WARNING: Profile not found in verification query! This member may not appear in the members list.`)
    } else {
      console.log(`[POST /api/v1/companies/${companyId}/members] ✅ Profile verified and should appear in members list:`, {
        id: verifyProfile.id,
        email: verifyProfile.email,
        status: verifyProfile.status,
        company_id: verifyProfile.company_id,
      })
    }

    return NextResponse.json(responseData, { status: 201 })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/companies/[id]/members", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

