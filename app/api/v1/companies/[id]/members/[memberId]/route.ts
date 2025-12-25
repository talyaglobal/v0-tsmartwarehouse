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
    const { role } = body

    // Check if user has permission
    if (user.role !== 'admin') {
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
      .select('id, role, company_id')
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

    // Prevent changing owner role (only one owner should exist)
    if (role && role !== 'owner' && member.role === 'owner') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Cannot change owner role. Transfer ownership first.",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Map invitation role to profile role
    const profileRole = role === 'owner' ? 'owner' :
                       role === 'company_admin' ? 'company_admin' :
                       role === 'member' ? 'customer' :
                       undefined

    const updates: Record<string, any> = {}
    if (profileRole !== undefined) {
      if (!['owner', 'company_admin', 'customer'].includes(profileRole)) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Invalid role. Must be 'owner', 'company_admin', or 'member'",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      updates.role = profileRole
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
    if (user.role !== 'super_admin') {
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
    const { data: member, error: memberError } = await supabase
      .from('profiles')
      .select('id, role, company_id')
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

    // Prevent deleting the last owner
    if (member.role === 'owner') {
      const { data: owners } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', 'owner')

      if (owners && owners.length <= 1) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Cannot delete the last owner. Transfer ownership first.",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
    }

    // Remove member by clearing company_id (soft delete)
    const { error } = await supabase
      .from('profiles')
      .update({ company_id: null, invited_by: null })
      .eq('id', memberId)

    if (error) {
      throw new Error(`Failed to delete company member: ${error.message}`)
    }

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

