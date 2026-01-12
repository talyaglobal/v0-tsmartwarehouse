import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import type { TransportDriver } from "@/types"
import { z } from "zod"

const updateDriverSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  photoUrl: z.string().url().optional().or(z.literal("")),
  licenseNumber: z.string().optional(),
  licenseType: z.string().optional(),
  licenseState: z.string().optional(),
  licenseExpiry: z.string().optional(),
  licensePlate: z.string().optional(),
  vehicleType: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.number().optional(),
  vehicleCapacity: z.string().optional(),
  hazmatCertified: z.boolean().optional(),
  hazmatExpiry: z.string().optional(),
  twicCard: z.boolean().optional(),
  twicExpiry: z.string().optional(),
  isActive: z.boolean().optional(),
  availabilityStatus: z.enum(["available", "on_job", "off_duty", "unavailable"]).optional(),
  currentLatitude: z.number().optional(),
  currentLongitude: z.number().optional(),
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
 * GET /api/v1/transport-drivers/[id]
 * Get a single transport driver
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from("transport_drivers")
      .select(`
        *,
        transport_companies (
          id,
          company_name,
          company_type,
          phone,
          email
        )
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Driver not found" } as ErrorResponse,
          { status: 404 }
        )
      }
      throw error
    }

    const driver = mapDriverRow(data)
    if (data.transport_companies) {
      driver.transportCompany = {
        id: data.transport_companies.id,
        companyName: data.transport_companies.company_name,
        companyType: data.transport_companies.company_type,
        phone: data.transport_companies.phone,
        email: data.transport_companies.email,
        isActive: true,
        isVerified: false,
        createdAt: "",
        updatedAt: "",
      }
    }

    return NextResponse.json({ success: true, data: driver })
  } catch (error) {
    console.error("[transport-drivers] Error fetching driver:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to fetch driver",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * PUT /api/v1/transport-drivers/[id]
 * Update a transport driver
 */
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    const body = await _request.json()
    const validationResult = updateDriverSchema.safeParse(body)

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

    const updateData: Record<string, any> = {}
    if (data.fullName !== undefined) updateData.full_name = data.fullName
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.email !== undefined) updateData.email = data.email || null
    if (data.photoUrl !== undefined) updateData.photo_url = data.photoUrl || null
    if (data.licenseNumber !== undefined) updateData.license_number = data.licenseNumber
    if (data.licenseType !== undefined) updateData.license_type = data.licenseType
    if (data.licenseState !== undefined) updateData.license_state = data.licenseState
    if (data.licenseExpiry !== undefined) updateData.license_expiry = data.licenseExpiry
    if (data.licensePlate !== undefined) updateData.license_plate = data.licensePlate
    if (data.vehicleType !== undefined) updateData.vehicle_type = data.vehicleType
    if (data.vehicleMake !== undefined) updateData.vehicle_make = data.vehicleMake
    if (data.vehicleModel !== undefined) updateData.vehicle_model = data.vehicleModel
    if (data.vehicleYear !== undefined) updateData.vehicle_year = data.vehicleYear
    if (data.vehicleCapacity !== undefined) updateData.vehicle_capacity = data.vehicleCapacity
    if (data.hazmatCertified !== undefined) updateData.hazmat_certified = data.hazmatCertified
    if (data.hazmatExpiry !== undefined) updateData.hazmat_expiry = data.hazmatExpiry
    if (data.twicCard !== undefined) updateData.twic_card = data.twicCard
    if (data.twicExpiry !== undefined) updateData.twic_expiry = data.twicExpiry
    if (data.isActive !== undefined) updateData.is_active = data.isActive
    if (data.availabilityStatus !== undefined) updateData.availability_status = data.availabilityStatus
    if (data.notes !== undefined) updateData.notes = data.notes

    // Handle location update
    if (data.currentLatitude !== undefined && data.currentLongitude !== undefined) {
      updateData.current_latitude = data.currentLatitude
      updateData.current_longitude = data.currentLongitude
      updateData.last_location_update = new Date().toISOString()
    }

    const { data: driver, error } = await supabase
      .from("transport_drivers")
      .update(updateData)
      .eq("id", id)
      .is("deleted_at", null)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Driver not found" } as ErrorResponse,
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, data: mapDriverRow(driver) })
  } catch (error) {
    console.error("[transport-drivers] Error updating driver:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to update driver",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * DELETE /api/v1/transport-drivers/[id]
 * Soft delete a transport driver
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    // Soft delete
    const { error } = await supabase
      .from("transport_drivers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, message: "Driver deleted" })
  } catch (error) {
    console.error("[transport-drivers] Error deleting driver:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to delete driver",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}
