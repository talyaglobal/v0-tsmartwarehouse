import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ApiResponse } from "@/types/api"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult
    const { id: companyId, memberId } = await params
    const body = await request.json()
    const { 
      role, 
      name, 
      email, 
      phone, 
      avatar_url,
      password
    } = body

    // Check if user has permission
    if (user.role !== 'root') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (userCompanyId !== companyId) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: You don't have permission to update this company's members",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
      
      const isAdmin = await isCompanyAdmin(user.id, companyId)
      if (!isAdmin) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: Only company admins can update company members",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    }

    const supabase = createServerSupabaseClient()
    
    // Verify member belongs to this company (from profiles table)
    const { data: member, error: memberError } = await supabase
      .from('profiles')
      .select('id, role, company_id, email')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .single()

    if (memberError || !member) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Member not found in this company",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Prevent changing warehouse owner role (only one owner should exist)
    if (role && role !== 'warehouse_owner' && member.role === 'warehouse_owner') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Cannot change warehouse owner role. Transfer ownership first.",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Prevent changing root role
    if (role && member.role === 'root' && role !== 'root') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Cannot change root role",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Build updates object
    const updates: Record<string, any> = {}
    
    // Update role (map to new role system)
    if (role !== undefined) {
      // Only allow company_admin and warehouse_staff for team members
      const validRoles = ['company_admin', 'warehouse_staff']
      if (!validRoles.includes(role)) {
        const errorData: ErrorResponse = {
          success: false,
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      updates.role = role
    }

    // Update name (nullable field - normalize empty strings to null)
    if (name !== undefined) {
      // Normalize empty string to null for nullable fields
      updates.name = (name && name.trim() !== "") ? name.trim() : null
    }

    // Update phone (nullable field - normalize empty strings to null)
    if (phone !== undefined) {
      // Normalize empty string to null for nullable fields
      updates.phone = (phone && phone.trim() !== "") ? phone.trim() : null
    }

    // Update avatar_url (nullable field - normalize empty strings to null)
    if (avatar_url !== undefined) {
      // Normalize empty string to null for nullable fields
      updates.avatar_url = (avatar_url && avatar_url.trim() !== "") ? avatar_url.trim() : null
    }

    // Update email (also update in auth.users)
    if (email !== undefined && email !== member.email) {
      // Check if email is already taken
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .neq('id', memberId)
        .maybeSingle()

      if (existingProfile) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Email is already taken",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }

      updates.email = email

      // Also update email in auth.users
      try {
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
        
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(memberId, {
          email: email,
        })

        if (authError) {
          console.error('Failed to update email in auth.users:', authError)
          // Continue with profile update even if auth update fails
        }
      } catch (authUpdateError) {
        console.error('Error updating email in auth.users:', authUpdateError)
        // Continue with profile update
      }
    }

    // Update password (in auth.users only, not in profiles)
    if (password !== undefined && password !== null && password.trim() !== "") {
      // Validate password length
      if (password.length < 6) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Password must be at least 6 characters",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }

      try {
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
        
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(memberId, {
          password: password,
        })

        if (passwordError) {
          console.error('Failed to update password in auth.users:', passwordError)
          const errorData: ErrorResponse = {
            success: false,
            error: `Failed to update password: ${passwordError.message}`,
            statusCode: 500,
          }
          return NextResponse.json(errorData, { status: 500 })
        }
      } catch (passwordUpdateError) {
        console.error('Error updating password in auth.users:', passwordUpdateError)
        const errorData: ErrorResponse = {
          success: false,
          error: 'Failed to update password',
          statusCode: 500,
        }
        return NextResponse.json(errorData, { status: 500 })
      }
    }

    if (Object.keys(updates).length === 0) {
      const errorData: ErrorResponse = {
        success: false,
        error: "No fields to update",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', memberId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update company member: ${error.message}`)
    }

    const responseData: ApiResponse = {
      success: true,
      data,
      message: "Company member updated successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/companies/[id]/members/[memberId]", method: "PATCH" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult
    const { id: companyId, memberId } = await params

    // Check if user has permission
    if (user.role !== 'root') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (userCompanyId !== companyId) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: You don't have permission to delete this company's members",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
      
      const isAdmin = await isCompanyAdmin(user.id, companyId)
      if (!isAdmin) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: Only company admins can delete company members",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    }

    const supabase = createServerSupabaseClient()
    
    // Verify member belongs to this company (from profiles table)
    // Note: We check status = true to ensure member is active
    const { data: member, error: memberError } = await supabase
      .from('profiles')
      .select('id, role, company_id, status')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .eq('status', true) // Only allow deleting active members
      .single()

    if (memberError || !member) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Member not found in this company",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Prevent deleting the last warehouse owner
    if (member.role === 'warehouse_owner') {
      const { data: owners } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', 'warehouse_owner')

      if (owners && owners.length <= 1) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Cannot delete the last company owner. Transfer ownership first.",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
    }

    // Prevent deleting root users
    if (member.role === 'root') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Cannot delete root users",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Soft delete - Set status = false in profiles table
    // Note: We do NOT delete from auth.users - only soft delete in profiles
    const { error: softDeleteError } = await supabase
      .from('profiles')
      .update({ status: false })
      .eq('id', memberId)

    if (softDeleteError) {
      console.error('Failed to soft delete profile:', softDeleteError)
      throw new Error(`Failed to soft delete profile: ${softDeleteError.message}`)
    }

    console.log(`✅ Profile ${memberId} soft deleted (status = false)`)

    const responseData: ApiResponse = {
      success: true,
      message: "Company member deleted successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/companies/[id]/members/[memberId]", method: "DELETE" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

