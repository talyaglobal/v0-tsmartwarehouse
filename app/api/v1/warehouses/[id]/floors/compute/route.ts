import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/auth/api-middleware"
import { getUserCompanyId } from "@/lib/auth/company-admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse, ApiResponse } from "@/types/api"
import { handleApiError } from "@/lib/utils/logger"
import { calculateFloorCapacity } from "@/lib/planner/capacity"

const palletSchema = z.object({
  palletType: z.enum(["standard", "euro", "custom"]),
  lengthM: z.number().positive(),
  widthM: z.number().positive(),
  heightM: z.number().positive(),
})

const floorSchema = z.object({
  lengthM: z.number().positive(),
  widthM: z.number().positive(),
  heightM: z.number().positive(),
  wallClearanceM: z.number().nonnegative(),
  sprinklerClearanceM: z.number().nonnegative(),
  safetyClearanceM: z.number().nonnegative(),
  loadingZoneDepthM: z.number().nonnegative(),
  dockZoneDepthM: z.number().nonnegative(),
  stackingOverride: z.number().int().positive().nullable().optional(),
  zones: z.array(
    z.object({
      zoneType: z.string().min(1),
      xM: z.number().nonnegative(),
      yM: z.number().nonnegative(),
      widthM: z.number().positive(),
      heightM: z.number().positive(),
      rotationDeg: z.number().optional(),
    })
  ).optional(),
})

const computeSchema = z.object({
  floor: floorSchema,
  pallets: z.array(palletSchema),
})

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

export async function POST(
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

    const body = await request.json()
    const validated = computeSchema.parse(body)

    const capacity = calculateFloorCapacity(validated.floor, validated.pallets)
    const responseData: ApiResponse = {
      success: true,
      data: capacity,
    }
    return NextResponse.json(responseData, { status: 200 })
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
    const errorResponse = handleApiError(error, { path: "/api/v1/warehouses/[id]/floors/compute", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
