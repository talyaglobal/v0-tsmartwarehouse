import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"

/**
 * GET /api/v1/favorites/check
 * Check if a warehouse is in user's favorites
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const warehouse_id = searchParams.get("warehouse_id")

    if (!warehouse_id) {
      return NextResponse.json(
        { success: false, error: "warehouse_id is required" } as ErrorResponse,
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // If not authenticated, return false (not favorited)
    if (authError || !user) {
      return NextResponse.json({
        success: true,
        isFavorite: false,
      })
    }

    // Check if warehouse is in user's favorites
    const { data: favorite } = await supabase
      .from("warehouse_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("warehouse_id", warehouse_id)
      .single()

    return NextResponse.json({
      success: true,
      isFavorite: !!favorite,
    })
  } catch (error) {
    console.error("[favorites/check] Error:", error)
    return NextResponse.json({
      success: true,
      isFavorite: false,
    })
  }
}
