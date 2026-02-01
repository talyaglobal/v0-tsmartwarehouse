import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { handleApiError } from "@/lib/utils/logger"
import type { ApiResponse, ErrorResponse } from "@/types/api"

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('short_name', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`)
    }

    const responseData: ApiResponse = {
      success: true,
      data: data || [],
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/companies" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await request.json()
    const { name, short_name, trading_name, logo_url } = body
    
    // Use short_name if provided, otherwise fall back to name
    const shortNameValue = short_name || name

    if (!shortNameValue || typeof shortNameValue !== 'string' || shortNameValue.trim() === '') {
      const errorData: ErrorResponse = {
        success: false,
        error: "Company short name is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('companies')
      .insert({
        short_name: shortNameValue.trim(),
        trading_name: trading_name?.trim() || shortNameValue.trim(),
        logo_url: logo_url || null,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create company: ${error.message}`)
    }

    const responseData: ApiResponse = {
      success: true,
      data,
      message: "Company created successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/companies", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

