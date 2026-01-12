import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import { z } from "zod"
import type { ErrorResponse } from "@/types/api"

const assignStaffSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  role: z.enum(['manager', 'staff']).default('staff'),
})

/**
 * GET /api/v1/warehouses/[id]/staff
 * Get all staff assigned to a warehouse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    // Handle both Promise and direct params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params
    const warehouseId = resolvedParams.id
    const supabase = createServerSupabaseClient()

    // Get assigned staff with user details
    const { data: assignments, error } = await supabase
      .from('warehouse_staff')
      .select(`
        id,
        user_id,
        role,
        created_at,
        profiles!warehouse_staff_user_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('warehouse_id', warehouseId)
      .eq('status', true) // Only active assignments

    if (error) {
      throw new Error(`Failed to fetch warehouse staff: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      data: assignments || [],
      total: assignments?.length || 0,
    })
  } catch (error) {
    console.error("Error fetching warehouse staff:", error)
    const resolvedParams = params instanceof Promise ? await params : params
    const errorResponse = handleApiError(error, { path: `/api/v1/warehouses/${resolvedParams.id}/staff` })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * POST /api/v1/warehouses/[id]/staff
 * Assign a warehouse staff member to a warehouse
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // Check if user is warehouse_owner (or owner), company_admin, or root
    const allowedRoles = ['warehouse_admin', 'owner', 'company_admin', 'root']
    if (!allowedRoles.includes(user.role)) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Unauthorized: Only warehouse owners, company admins, or root can assign warehouse staff",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Handle both Promise and direct params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params
    const warehouseId = resolvedParams.id
    const body = await request.json()

    // Validate request body
    let validatedData
    try {
      validatedData = assignStaffSchema.parse(body)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        const errorData: ErrorResponse = {
          success: false,
          error: "Validation error",
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: zodError.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", "),
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    const supabase = createServerSupabaseClient()

    // Verify warehouse exists and belongs to user's company
    console.log('Looking for warehouse with ID:', warehouseId)
    const { data: warehouse, error: warehouseError } = await supabase
      .from('warehouses')
      .select('id, owner_company_id')
      .eq('id', warehouseId)
      .single()

    if (warehouseError) {
      console.error('Warehouse query error:', warehouseError)
      const errorData: ErrorResponse = {
        success: false,
        error: `Warehouse not found: ${warehouseError.message}`,
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    if (!warehouse) {
      console.error('Warehouse not found for ID:', warehouseId)
      const errorData: ErrorResponse = {
        success: false,
        error: "Warehouse not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    console.log('Found warehouse:', warehouse)

    // Get user's company_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.company_id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "User is not associated with a company",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Verify warehouse belongs to user's company (unless root)
    if (user.role !== 'root' && warehouse.owner_company_id !== profile.company_id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Unauthorized: Warehouse does not belong to your company",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Verify the user to be assigned is a warehouse_staff in the same company
    const { data: staffProfile, error: staffError } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', validatedData.userId)
      .single()

    if (staffError || !staffProfile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Staff user not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    if (staffProfile.role !== 'warehouse_staff') {
      const errorData: ErrorResponse = {
        success: false,
        error: "User is not a warehouse staff member",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (user.role !== 'root' && staffProfile.company_id !== profile.company_id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Staff user does not belong to your company",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Check if assignment already exists
    const { data: existingAssignment } = await supabase
      .from('warehouse_staff')
      .select('id')
      .eq('warehouse_id', warehouseId)
      .eq('user_id', validatedData.userId)
      .eq('status', true)
      .maybeSingle()

    if (existingAssignment) {
      // Update existing assignment
      const { data: updated, error: updateError } = await supabase
        .from('warehouse_staff')
        .update({ role: validatedData.role })
        .eq('id', existingAssignment.id)
        .select(`
          id,
          user_id,
          role,
          created_at,
          profiles!warehouse_staff_user_id_fkey (
            id,
            name,
            email
          )
        `)
        .single()

      if (updateError) {
        throw new Error(`Failed to update assignment: ${updateError.message}`)
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Staff assignment updated successfully",
      })
    }

    // Create new assignment
    const { data: assignment, error: insertError } = await supabase
      .from('warehouse_staff')
      .insert({
        warehouse_id: warehouseId,
        user_id: validatedData.userId,
        role: validatedData.role,
        status: true,
      })
      .select(`
        id,
        user_id,
        role,
        created_at,
        profiles!warehouse_staff_user_id_fkey (
          id,
          name,
          email
        )
      `)
      .single()

    if (insertError) {
      throw new Error(`Failed to assign staff: ${insertError.message}`)
    }

    return NextResponse.json({
      success: true,
      data: assignment,
      message: "Staff assigned successfully",
    })
  } catch (error) {
    console.error("Error assigning warehouse staff:", error)
    const resolvedParams = params instanceof Promise ? await params : params
    const errorResponse = handleApiError(error, { path: `/api/v1/warehouses/${resolvedParams.id}/staff` })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

/**
 * DELETE /api/v1/warehouses/[id]/staff
 * Remove a warehouse staff member from a warehouse
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // Check if user is warehouse_owner (or owner), company_admin, or root
    const allowedRoles = ['warehouse_admin', 'owner', 'company_admin', 'root']
    if (!allowedRoles.includes(user.role)) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Unauthorized: Only warehouse owners, company admins, or root can remove warehouse staff",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Handle both Promise and direct params (Next.js 15+ uses Promise)
    const resolvedParams = params instanceof Promise ? await params : params
    const warehouseId = resolvedParams.id
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      const errorData: ErrorResponse = {
        success: false,
        error: "userId parameter is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Soft delete (set status to false)
    const { error } = await supabase
      .from('warehouse_staff')
      .update({ status: false })
      .eq('warehouse_id', warehouseId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to remove staff: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: "Staff removed successfully",
    })
  } catch (error) {
    console.error("Error removing warehouse staff:", error)
    const resolvedParams = params instanceof Promise ? await params : params
    const errorResponse = handleApiError(error, { path: `/api/v1/warehouses/${resolvedParams.id}/staff` })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

