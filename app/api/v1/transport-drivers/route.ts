import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import type { PaginatedResponse } from "@/types"
import type { TransportDriver, DriverAvailabilityStatus } from "@/types"
import { z } from "zod"

const createDriverSchema = z.object({
  transportCompanyId: z.string().uuid("Invalid company ID"),
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  photoUrl: z.string().url().optional().or(z.literal("")),
  licenseNumber: z.string().min(1, "License number is required"),
  licenseType: z.string().optional(),
  licenseState: z.string().optional(),
  licenseExpiry: z.string().optional(),
  licensePlate: z.string().optional(),
  vehicleType: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.number().optional(),
  vehicleCapacity: z.string().optional(),
  hazmatCertified: z.boolean().default(false),
  hazmatExpiry: z.string().optional(),
  twicCard: z.boolean().default(false),
  twicExpiry: z.string().optional(),
  notes: z.string().optional(),
})

function mapDriverRow(row: any): TransportDriver {
  return {
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
  }
}

/**
 * GET /api/v1/transport-drivers
 * List all transport drivers with pagination and filters
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
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")
    const transportCompanyId = searchParams.get("transportCompanyId")
    const isActive = searchParams.get("isActive")
    const availabilityStatus = searchParams.get("availabilityStatus") as DriverAvailabilityStatus | null
    const search = searchParams.get("search")

    const offset = (page - 1) * pageSize

    let query = supabase
      .from("transport_drivers")
      .select(`
        *,
        transport_companies (
          id,
          company_name,
          company_type
        )
      `, { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (transportCompanyId) {
      query = query.eq("transport_company_id", transportCompanyId)
    }

    if (isActive !== null) {
      query = query.eq("is_active", isActive === "true")
    }

    if (availabilityStatus) {
      query = query.eq("availability_status", availabilityStatus)
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,license_plate.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw error
    }

    const drivers: TransportDriver[] = (data || []).map(row => {
      const driver = mapDriverRow(row)
      if (row.transport_companies) {
        driver.transportCompany = {
          id: row.transport_companies.id,
          companyName: row.transport_companies.company_name,
          companyType: row.transport_companies.company_type,
          isActive: true,
          isVerified: false,
          createdAt: "",
          updatedAt: "",
        }
      }
      return driver
    })

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
      context: "Failed to fetch transport drivers",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * POST /api/v1/transport-drivers
 * Create a new transport driver
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
    const validationResult = createDriverSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Validation failed", 
          details: validationResult.error.flatten().fieldErrors 
        } as ErrorResponse,
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Verify transport company exists
    const { data: company, error: companyError } = await supabase
      .from("transport_companies")
      .select("id")
      .eq("id", data.transportCompanyId)
      .is("deleted_at", null)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { success: false, error: "Transport company not found" } as ErrorResponse,
        { status: 404 }
      )
    }

    const { data: driver, error } = await supabase
      .from("transport_drivers")
      .insert({
        transport_company_id: data.transportCompanyId,
        full_name: data.fullName,
        phone: data.phone,
        email: data.email || null,
        photo_url: data.photoUrl || null,
        license_number: data.licenseNumber,
        license_type: data.licenseType,
        license_state: data.licenseState,
        license_expiry: data.licenseExpiry,
        license_plate: data.licensePlate,
        vehicle_type: data.vehicleType,
        vehicle_make: data.vehicleMake,
        vehicle_model: data.vehicleModel,
        vehicle_year: data.vehicleYear,
        vehicle_capacity: data.vehicleCapacity,
        hazmat_certified: data.hazmatCertified,
        hazmat_expiry: data.hazmatExpiry,
        twic_card: data.twicCard,
        twic_expiry: data.twicExpiry,
        notes: data.notes,
        is_active: true,
        availability_status: "available",
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data: mapDriverRow(driver) }, { status: 201 })
  } catch (error) {
    console.error("[transport-drivers] Error creating driver:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to create transport driver",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}
