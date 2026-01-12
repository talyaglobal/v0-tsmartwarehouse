import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import type { PaginatedResponse } from "@/types"
import type { TransportDriver } from "@/types"

/**
 * GET /api/v1/transport-companies/[id]/drivers
 * List drivers for a specific transport company
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")
    const isActive = searchParams.get("isActive")
    const availabilityStatus = searchParams.get("availabilityStatus")

    const offset = (page - 1) * pageSize

    let query = supabase
      .from("transport_drivers")
      .select("*", { count: "exact" })
      .eq("transport_company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (isActive !== null) {
      query = query.eq("is_active", isActive === "true")
    }

    if (availabilityStatus) {
      query = query.eq("availability_status", availabilityStatus)
    }

    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw error
    }

    const drivers: TransportDriver[] = (data || []).map(row => ({
      id: row.id,
      transportCompanyId: row.transport_company_id,
      userId: row.user_id,
      fullName: row.full_name,
      phone: row.phone,
      email: row.email,
      photoUrl: row.photo_url,
      licenseNumber: row.license_number,
      licenseType: row.license_type,
      licenseState: row.license_state,
      licenseExpiry: row.license_expiry,
      licensePlate: row.license_plate,
      vehicleType: row.vehicle_type,
      vehicleMake: row.vehicle_make,
      vehicleModel: row.vehicle_model,
      vehicleYear: row.vehicle_year,
      vehicleCapacity: row.vehicle_capacity,
      hazmatCertified: row.hazmat_certified,
      hazmatExpiry: row.hazmat_expiry,
      twicCard: row.twic_card,
      twicExpiry: row.twic_expiry,
      isActive: row.is_active,
      availabilityStatus: row.availability_status,
      currentLatitude: row.current_latitude,
      currentLongitude: row.current_longitude,
      lastLocationUpdate: row.last_location_update,
      notes: row.notes,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    const response: PaginatedResponse<TransportDriver> = {
      items: drivers,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error("[transport-drivers] Error fetching drivers:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to fetch drivers",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}
