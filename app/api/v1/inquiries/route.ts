import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const inquirySchema = z.object({
  warehouse_id: z.string().uuid(),
  interested_type: z.enum(["pallet", "area-rental"]).optional(),
  interested_quantity: z.number().min(1).optional(),
  interested_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  interested_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  message: z.string().min(10).max(1000),
})

/**
 * GET /api/v1/inquiries
 * Get inquiries (for host or guest)
 */
export async function GET(request: NextRequest) {
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
    const role = searchParams.get("role") // "host" or "guest"

    let query = supabase
      .from("inquiries")
      .select(`
        *,
        warehouses(id, name),
        profiles!inquiries_guest_id_fkey(id, name, avatar_url)
      `)
      .eq("status", true)

    if (role === "host") {
      // Host sees inquiries for their warehouses
      query = query.in("warehouse_id", [
        // Get warehouse IDs where user is owner
        // This would need a subquery in production
      ])
    } else {
      // Guest sees their own inquiries
      query = query.eq("guest_id", user.id)
    }

    if (warehouse_id) {
      query = query.eq("warehouse_id", warehouse_id)
    }

    const { data: inquiries, error } = await query.order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: inquiries || [],
    })
  } catch (error) {
    console.error("[inquiries] Error fetching inquiries:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to fetch inquiries",
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
 * POST /api/v1/inquiries
 * Create a new inquiry
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
    const validationResult = inquirySchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid inquiry data",
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          statusCode: 400,
        } as ErrorResponse,
        { status: 400 }
      )
    }

    const data = validationResult.data

    const { data: inquiry, error } = await supabase
      .from("inquiries")
      .insert({
        warehouse_id: data.warehouse_id,
        guest_id: user.id,
        interested_type: data.interested_type,
        interested_quantity: data.interested_quantity,
        interested_start_date: data.interested_start_date,
        interested_end_date: data.interested_end_date,
        message: data.message,
        inquiry_status: "pending",
      })
      .select(`
        *,
        warehouses(id, name),
        profiles!inquiries_guest_id_fkey(id, name)
      `)
      .single()

    if (error) {
      throw error
    }

    // TODO: Send notification email to host

    return NextResponse.json({
      success: true,
      data: inquiry,
    })
  } catch (error) {
    console.error("[inquiries] Error creating inquiry:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to create inquiry",
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
 * PATCH /api/v1/inquiries/[id]
 * Update inquiry status (host response)
 */
export async function PATCH(request: NextRequest) {
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
    const inquiry_id = searchParams.get("id")
    const body = await request.json()
    const { inquiry_status, converted_booking_id } = body

    if (!inquiry_id) {
      return NextResponse.json(
        { success: false, error: "inquiry id is required" } as ErrorResponse,
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (inquiry_status) {
      updateData.inquiry_status = inquiry_status
    }
    if (converted_booking_id) {
      updateData.converted_booking_id = converted_booking_id
    }
    if (inquiry_status === "responded") {
      updateData.responded_at = new Date().toISOString()
    }

    const { data: inquiry, error } = await supabase
      .from("inquiries")
      .update(updateData)
      .eq("id", inquiry_id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: inquiry,
    })
  } catch (error) {
    console.error("[inquiries] Error updating inquiry:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to update inquiry",
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

