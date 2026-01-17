import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth/api-middleware"
import { getUserCompanyId } from "@/lib/auth/company-admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { ErrorResponse, ApiResponse, ListResponse } from "@/types/api"
import { handleApiError } from "@/lib/utils/logger"

const floorZoneSchema = z.object({
  zoneType: z.string().min(1),
  xM: z.number().nonnegative(),
  yM: z.number().nonnegative(),
  widthM: z.number().positive(),
  heightM: z.number().positive(),
  rotationDeg: z.number().optional(),
})

const floorPlanSchema = z.object({
  name: z.string().min(1),
  floorLevel: z.number().int(),
  lengthM: z.number().positive(),
  widthM: z.number().positive(),
  heightM: z.number().positive(),
  wallClearanceM: z.number().nonnegative(),
  sprinklerClearanceM: z.number().nonnegative(),
  safetyClearanceM: z.number().nonnegative(),
  mainAisleM: z.number().nonnegative(),
  sideAisleM: z.number().nonnegative(),
  pedestrianAisleM: z.number().nonnegative(),
  loadingZoneDepthM: z.number().nonnegative(),
  dockZoneDepthM: z.number().nonnegative(),
  standardPalletHeightM: z.number().positive(),
  euroPalletHeightM: z.number().positive(),
  customPalletLengthCm: z.number().positive(),
  customPalletWidthCm: z.number().positive(),
  customPalletHeightCm: z.number().positive(),
  stackingOverride: z.number().int().positive().nullable().optional(),
  outlinePoints: z
    .array(
      z.object({
        xM: z.number().nonnegative(),
        yM: z.number().nonnegative(),
      })
    )
    .optional(),
  zones: z.array(floorZoneSchema),
})

const floorPlansSchema = z.array(floorPlanSchema)

const ensureWarehouseAccess = async (supabase: ReturnType<typeof createServerSupabaseClient>, warehouseId: string, user: { id: string; role: string }) => {
  if (user.role === "root") return true
  const userCompanyId = await getUserCompanyId(user.id)
  if (!userCompanyId) return false
  const { data, error } = await supabase
    .from("warehouses")
    .select("id, owner_company_id")
    .eq("id", warehouseId)
    .single()
  if (error || !data) return false
  return data.owner_company_id === userCompanyId
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult
    const supabase = await createServerSupabaseClient()
    const resolvedParams = await Promise.resolve(params)

    const hasAccess = await ensureWarehouseAccess(supabase, resolvedParams.id, user)
    if (!hasAccess) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Forbidden",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const { data, error } = await supabase
      .from("warehouse_floors")
      .select(
        `id,name,floor_level,length_m,width_m,height_m,wall_clearance_m,sprinkler_clearance_m,safety_clearance_m,main_aisle_m,side_aisle_m,pedestrian_aisle_m,loading_zone_depth_m,dock_zone_depth_m,standard_pallet_height_m,euro_pallet_height_m,custom_pallet_length_cm,custom_pallet_width_cm,custom_pallet_height_cm,stacking_override,outline_points,status,warehouse_floor_zones(id,zone_type,x_m,y_m,width_m,height_m,rotation_deg,status)`
      )
      .eq("warehouse_id", resolvedParams.id)
      .eq("status", true)
      .order("floor_level", { ascending: true })

    if (error) {
      throw error
    }

    const responseData: ListResponse<any> = {
      success: true,
      data: data || [],
      total: data?.length ?? 0,
    }
    return NextResponse.json(responseData, { status: 200 })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/warehouses/[id]/floors", method: "GET" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult
    const supabase = await createServerSupabaseClient()
    const adminClient = createAdminClient()
    const resolvedParams = await Promise.resolve(params)

    const hasAccess = await ensureWarehouseAccess(supabase, resolvedParams.id, user)
    if (!hasAccess) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Forbidden",
        statusCode: 403,
      }
      return NextResponse.json(errorData, { status: 403 })
    }

    const body = await request.json()
    const validated = floorPlansSchema.parse(body)

    const { data: existingFloors } = await adminClient
      .from("warehouse_floors")
      .select("id")
      .eq("warehouse_id", resolvedParams.id)

    const floorIds = (existingFloors || []).map((floor) => floor.id)
    if (floorIds.length > 0) {
      await adminClient.from("warehouse_floor_zones").delete().in("floor_id", floorIds)
      await adminClient.from("warehouse_floor_aisle_defs").delete().in("floor_id", floorIds)
      await adminClient.from("warehouse_floor_pallet_layouts").delete().in("floor_id", floorIds)
      await adminClient.from("warehouse_floors").delete().in("id", floorIds)
    }

    const { data: floorRows, error: floorError } = await adminClient
      .from("warehouse_floors")
      .insert(
        validated.map((floor) => ({
          warehouse_id: resolvedParams.id,
          name: floor.name,
          floor_level: floor.floorLevel,
          floor_number: floor.floorLevel,
          total_sq_ft: Math.round(floor.lengthM * floor.widthM * 10.7639),
          length_m: floor.lengthM,
          width_m: floor.widthM,
          height_m: floor.heightM,
          wall_clearance_m: floor.wallClearanceM,
          sprinkler_clearance_m: floor.sprinklerClearanceM,
          safety_clearance_m: floor.safetyClearanceM,
          main_aisle_m: floor.mainAisleM > 0 ? floor.mainAisleM : 3.5,
          side_aisle_m: floor.sideAisleM > 0 ? floor.sideAisleM : 2.5,
          pedestrian_aisle_m: floor.pedestrianAisleM > 0 ? floor.pedestrianAisleM : 1.0,
          loading_zone_depth_m: floor.loadingZoneDepthM,
          dock_zone_depth_m: floor.dockZoneDepthM,
          standard_pallet_height_m: floor.standardPalletHeightM,
          euro_pallet_height_m: floor.euroPalletHeightM,
          custom_pallet_length_cm: floor.customPalletLengthCm,
          custom_pallet_width_cm: floor.customPalletWidthCm,
          custom_pallet_height_cm: floor.customPalletHeightCm,
          stacking_override: floor.stackingOverride ?? null,
          outline_points: floor.outlinePoints ?? null,
          status: true,
        }))
      )
      .select("id")

    if (floorError || !floorRows) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to save floor plans",
          details: floorError?.message || "Failed to create floors",
        },
        { status: 500 }
      )
    }

    const zoneRows = floorRows.flatMap((floorRow, index) => {
      const floor = validated[index]
      return (floor.zones || []).map((zone) => ({
        floor_id: floorRow.id,
        zone_type: zone.zoneType,
        x_m: zone.xM,
        y_m: zone.yM,
        width_m: zone.widthM,
        height_m: zone.heightM,
        rotation_deg: zone.rotationDeg ?? 0,
        status: true,
      }))
    })
    if (zoneRows.length > 0) {
      const { error: zoneError } = await adminClient.from("warehouse_floor_zones").insert(zoneRows)
      if (zoneError) {
        return NextResponse.json(
          {
            success: false,
            error: "Failed to save floor plan zones",
            details: zoneError.message,
          },
          { status: 500 }
        )
      }
    }

    const responseData: ApiResponse = {
      success: true,
      message: "Floors created",
    }
    return NextResponse.json(responseData, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Validation error",
        statusCode: 400,
        details: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
      }
      return NextResponse.json(errorData, { status: 400 })
    }
    const errorResponse = handleApiError(error, { path: "/api/v1/warehouses/[id]/floors", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
