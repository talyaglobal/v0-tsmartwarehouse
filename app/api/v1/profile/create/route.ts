import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse, ApiResponse } from "@/types/api"

/**
 * POST /api/v1/profile/create
 * Create a profile for a user (server-side, uses admin client)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Unauthorized",
        statusCode: 401,
      }
      return NextResponse.json(errorData, { status: 401 })
    }

    const body = await request.json()
    const { userId, email, name, role, phone, company } = body

    // Verify the userId matches the authenticated user
    if (userId !== user.id) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Forbidden: Cannot create profile for another user",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Use admin client to create profile (bypasses RLS)
    const supabaseAdmin = createServerSupabaseClient()

    // Check if profile already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (existingProfile) {
      const responseData: ApiResponse = {
        success: true,
        data: existingProfile,
        message: "Profile already exists",
      }
      return NextResponse.json(responseData)
    }

    // Create profile
    const { data: newProfile, error: createError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        email: email?.toLowerCase().trim() || user.email,
        name: name || email?.split('@')[0] || user.email?.split('@')[0],
        role: role || 'customer',
        phone: phone || null,
        company: company || null,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating profile:', createError)
      const errorData: ErrorResponse = {
        success: false,
        error: `Failed to create profile: ${createError.message}`,
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    const responseData: ApiResponse = {
      success: true,
      data: newProfile,
      message: "Profile created successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/profile/create", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

