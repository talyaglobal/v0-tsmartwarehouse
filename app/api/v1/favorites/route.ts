import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/favorites
 * Get user's favorite warehouses
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    const { data: favorites, error } = await supabase
      .from("warehouse_favorites")
      .select(`
        id,
        warehouse_id,
        notes,
        created_at,
        warehouses (
          id,
          name,
          address,
          city,
          photos
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: favorites || [],
    })
  } catch (error) {
    console.error("[favorites] Error fetching favorites:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to fetch favorites",
    })
    return NextResponse.json(
      {
        success: false,
        error: errorResponse.message,
      } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * POST /api/v1/favorites
 * Add warehouse to favorites
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    const body = await request.json()
    const { warehouse_id, notes } = body

    if (!warehouse_id) {
      return NextResponse.json(
        { success: false, error: "warehouse_id is required" } as ErrorResponse,
        { status: 400 }
      )
    }

    // Check if already favorited
    const { data: existing } = await supabase
      .from("warehouse_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("warehouse_id", warehouse_id)
      .single()

    if (existing) {
      return NextResponse.json({
        success: true,
        data: existing,
        message: "Already in favorites",
      })
    }

    const { data: favorite, error } = await supabase
      .from("warehouse_favorites")
      .insert({
        user_id: user.id,
        warehouse_id,
        notes: notes || null,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: favorite,
    })
  } catch (error) {
    console.error("[favorites] Error adding favorite:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to add favorite",
    })
    return NextResponse.json(
      {
        success: false,
        error: errorResponse.message,
      } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * DELETE /api/v1/favorites
 * Remove warehouse from favorites
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const warehouse_id = searchParams.get("warehouse_id")

    if (!warehouse_id) {
      return NextResponse.json(
        { success: false, error: "warehouse_id is required" } as ErrorResponse,
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("warehouse_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("warehouse_id", warehouse_id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: "Removed from favorites",
    })
  } catch (error) {
    console.error("[favorites] Error removing favorite:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to remove favorite",
    })
    return NextResponse.json(
      {
        success: false,
        error: errorResponse.message,
      } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

