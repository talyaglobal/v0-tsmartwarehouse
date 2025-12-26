import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ListResponse } from "@/types/api"

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
    // Include all roles except warehouse_staff (they have their own management)
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
        created_at,
        updated_at
      `)
      .eq('company_id', companyId)
      .eq('status', true) // Only show active (non-deleted) members
      .not('role', 'eq', 'warehouse_staff') // Exclude warehouse_staff from team members list
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

