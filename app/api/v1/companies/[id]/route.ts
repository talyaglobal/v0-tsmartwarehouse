import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import type { ApiResponse, ErrorResponse } from "@/types/api"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const { id } = await params
    const body = await request.json()
    const { name, logo_url, vat, address, postal_code, city, country } = body

    // Check if user has permission to update this company
    // Root can update any company
    // Company admin/owner can only update their own company
    if (user.role !== 'root') {
      const userCompanyId = await getUserCompanyId(user.id)
      if (userCompanyId !== id) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: You don't have permission to update this company",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
      
      // Verify user is company admin or owner
      const isAdmin = await isCompanyAdmin(user.id, id)
      if (!isAdmin) {
        const errorData: ErrorResponse = {
          success: false,
          error: "Forbidden: Only company admins can update company information",
          statusCode: 403,
        }
        return NextResponse.json(errorData, { status: 403 })
      }
    }

    const supabase = createServerSupabaseClient()
    
    const updates: Record<string, any> = {}
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        const errorData: ErrorResponse = {
          success: false,
          error: "Company name cannot be empty",
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      
      const trimmedName = name.trim()
      
      // Check if a company with this name already exists (excluding current company)
      // Use case-insensitive comparison
      const { data: existingCompany, error: checkError } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', trimmedName)
        .neq('id', id)
        .maybeSingle()
      
      if (checkError) {
        throw new Error(`Failed to check company name: ${checkError.message}`)
      }
      
      if (existingCompany) {
        const errorData: ErrorResponse = {
          success: false,
          error: `A company with the name "${trimmedName}" already exists`,
          statusCode: 409, // Conflict
        }
        return NextResponse.json(errorData, { status: 409 })
      }
      
      updates.name = trimmedName
    }
    if (logo_url !== undefined) {
      updates.logo_url = logo_url || null
    }
    if (vat !== undefined) {
      updates.vat = vat || null
    }
    if (address !== undefined) {
      updates.address = address || null
    }
    if (postal_code !== undefined) {
      updates.postal_code = postal_code || null
    }
    if (city !== undefined) {
      updates.city = city || null
    }
    if (country !== undefined) {
      updates.country = country || null
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
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update company: ${error.message}`)
    }

    const responseData: ApiResponse = {
      success: true,
      data,
      message: "Company updated successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/companies/[id]", method: "PATCH" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

