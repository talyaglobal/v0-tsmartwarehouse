import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ListResponse } from "@/types/api"
import type { User } from "@/types"

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role") as "root" | "warehouse_client" | "warehouse_staff" | "warehouse_supervisor" | null
    const companyId = searchParams.get("companyId")

    const supabase = createServerSupabaseClient()

    // Build query
    let query = supabase
      .from('profiles')
      .select(`
        id,
        email,
        name,
        role,
        phone,
        avatar_url,
        membership_tier,
        credit_balance,
        company_id,
        created_at,
        updated_at,
        companies(name)
      `)

    // Apply filters
    if (role) {
      query = query.eq('role', role)
    }

    // Company admin can only see users from their company
    // System admin can see all users
    if (user.role !== 'root') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (userCompanyId) {
        const isAdmin = await isCompanyAdmin(user.id, userCompanyId)
        if (isAdmin) {
          // Company admin - show only users from their company
          query = query.eq('company_id', userCompanyId)
        } else {
          // Regular user - show only themselves
          query = query.eq('id', user.id)
        }
      } else {
        // No company - show only themselves
        query = query.eq('id', user.id)
      }
    } else if (companyId) {
      // System admin filtering by company
      query = query.eq('company_id', companyId)
    }

    const { data: profiles, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`)
    }

    // Transform profiles to User type with company role information
    const users: (User & { companyRole?: 'warehouse_admin' | 'warehouse_admin' | 'warehouse_staff' | null })[] = (profiles || []).map((profile: any) => {
      const company = Array.isArray(profile.companies) ? profile.companies[0] : profile.companies

      // Map profile role to company role: 'warehouse_admin' -> 'warehouse_admin', 'warehouse_admin' -> 'warehouse_admin', 'warehouse_staff' -> 'warehouse_staff'
      const companyRole: 'warehouse_admin' | 'warehouse_admin' | 'warehouse_staff' | null =
        profile.role === 'warehouse_admin' ? 'warehouse_admin' :
        profile.role === 'warehouse_admin' ? 'warehouse_admin' :
        profile.role === 'warehouse_staff' ? 'warehouse_staff' : null

      return {
        id: profile.id,
        email: profile.email,
        name: profile.name || '',
        role: profile.role as User['role'],
        companyId: profile.company_id || undefined,
        companyName: company?.name || undefined,
        phone: profile.phone || undefined,
        avatar: profile.avatar_url || undefined,
        membershipTier: profile.membership_tier as User['membershipTier'] || undefined,
        creditBalance: profile.credit_balance ? parseFloat(profile.credit_balance) : undefined,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        companyRole, // Role in company (from profiles.role)
      }
    })

    const responseData: ListResponse<User & { companyRole?: 'warehouse_admin' | 'warehouse_admin' | 'warehouse_staff' | null }> = {
      success: true,
      data: users,
      total: users.length,
    }

    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/users" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

