import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api-middleware"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import { z } from "zod"

const discoverWarehousesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius_km: z.number().positive().default(10),
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user } = authResult
    const supabase = createServerSupabaseClient()

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single()

    if (!profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "User profile not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Check if user has permission (warehouse_finder or admin)
    if (!["warehouse_finder", "root", "warehouse_admin", "warehouse_owner"].includes(profile.role)) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Forbidden",
        statusCode: 403,
        message: "You do not have permission to discover warehouses",
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    // Parse and validate request body
    const body = await request.json()
    let validatedData
    try {
      validatedData = discoverWarehousesSchema.parse(body)
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

    // Call PostGIS function to find warehouses near location
    const { data: warehouses, error: rpcError } = await supabase.rpc(
      "find_warehouses_near_location",
      {
        lat: validatedData.latitude,
        lng: validatedData.longitude,
        radius_km: validatedData.radius_km,
      }
    )

    if (rpcError) {
      return NextResponse.json(
        { success: false, error: rpcError.message },
        { status: 500 }
      )
    }

    // Check which warehouses are already in user's CRM
    const warehouseIds = (warehouses || []).map((w: any) => w.id)
    
    let existingContactsQuery = supabase
      .from("crm_contacts")
      .select("converted_to_warehouse_id")
      .eq("created_by", user.id)
      .eq("contact_type", "warehouse_supplier")
      .not("converted_to_warehouse_id", "is", null)

    if (warehouseIds.length > 0) {
      existingContactsQuery = existingContactsQuery.in("converted_to_warehouse_id", warehouseIds)
    }

    const { data: existingContacts } = await existingContactsQuery

    const existingWarehouseIds = new Set(
      (existingContacts || []).map((c: any) => c.converted_to_warehouse_id)
    )

    // Enrich warehouses with in_crm flag
    const enrichedWarehouses = (warehouses || []).map((warehouse: any) => ({
      id: warehouse.id,
      name: warehouse.name,
      address: warehouse.address,
      city: warehouse.city,
      latitude: warehouse.latitude,
      longitude: warehouse.longitude,
      totalSqFt: warehouse.total_sq_ft,
      distanceKm: warehouse.distance_km,
      inCrm: existingWarehouseIds.has(warehouse.id),
    }))

    return NextResponse.json({ success: true, data: enrichedWarehouses })
  } catch (error) {
    const errorResult = handleApiError(error, { action: "Failed to discover warehouses" })
    return NextResponse.json(
      { success: false, error: errorResult.message, code: errorResult.code },
      { status: errorResult.statusCode }
    )
  }
}

