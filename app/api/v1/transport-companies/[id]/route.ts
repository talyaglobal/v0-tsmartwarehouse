import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import type { TransportCompany } from "@/types"
import { z } from "zod"

const updateTransportCompanySchema = z.object({
  companyName: z.string().min(1).optional(),
  companyType: z.enum(["local", "international", "end_delivery"]).optional(),
  taxNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  contactPersonName: z.string().optional(),
  contactPersonPhone: z.string().optional(),
  contactPersonEmail: z.string().email().optional().or(z.literal("")),
  licenseNumber: z.string().optional(),
  licenseExpiry: z.string().optional(),
  insuranceNumber: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  dotNumber: z.string().optional(),
  mcNumber: z.string().optional(),
  serviceAreas: z.array(z.string()).optional(),
  serviceCountries: z.array(z.string()).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
})

function mapCompanyRow(row: any): TransportCompany {
  return {
    id: row.id,
    companyName: row.company_name,
    companyType: row.company_type,
    taxNumber: row.tax_number,
    registrationNumber: row.registration_number,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    zipCode: row.zip_code,
    phone: row.phone,
    email: row.email,
    website: row.website,
    contactPersonName: row.contact_person_name,
    contactPersonPhone: row.contact_person_phone,
    contactPersonEmail: row.contact_person_email,
    licenseNumber: row.license_number,
    licenseExpiry: row.license_expiry,
    insuranceNumber: row.insurance_number,
    insuranceExpiry: row.insurance_expiry,
    dotNumber: row.dot_number,
    mcNumber: row.mc_number,
    serviceAreas: row.service_areas,
    serviceCountries: row.service_countries,
    userId: row.user_id,
    isActive: row.is_active,
    isVerified: row.is_verified,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    notes: row.notes,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * GET /api/v1/transport-companies/[id]
 * Get a single transport company
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
      .from("transport_companies")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Transport company not found" } as ErrorResponse,
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, data: mapCompanyRow(data) })
  } catch (error) {
    console.error("[transport-companies] Error fetching company:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to fetch transport company",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * PUT /api/v1/transport-companies/[id]
 * Update a transport company
 */
export async function PUT(
  request: NextRequest,
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

    const body = await request.json()
    const validationResult = updateTransportCompanySchema.safeParse(body)

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
    if (data.companyName !== undefined) updateData.company_name = data.companyName
    if (data.companyType !== undefined) updateData.company_type = data.companyType
    if (data.taxNumber !== undefined) updateData.tax_number = data.taxNumber
    if (data.registrationNumber !== undefined) updateData.registration_number = data.registrationNumber
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.state !== undefined) updateData.state = data.state
    if (data.country !== undefined) updateData.country = data.country
    if (data.zipCode !== undefined) updateData.zip_code = data.zipCode
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.email !== undefined) updateData.email = data.email || null
    if (data.website !== undefined) updateData.website = data.website || null
    if (data.contactPersonName !== undefined) updateData.contact_person_name = data.contactPersonName
    if (data.contactPersonPhone !== undefined) updateData.contact_person_phone = data.contactPersonPhone
    if (data.contactPersonEmail !== undefined) updateData.contact_person_email = data.contactPersonEmail || null
    if (data.licenseNumber !== undefined) updateData.license_number = data.licenseNumber
    if (data.licenseExpiry !== undefined) updateData.license_expiry = data.licenseExpiry
    if (data.insuranceNumber !== undefined) updateData.insurance_number = data.insuranceNumber
    if (data.insuranceExpiry !== undefined) updateData.insurance_expiry = data.insuranceExpiry
    if (data.dotNumber !== undefined) updateData.dot_number = data.dotNumber
    if (data.mcNumber !== undefined) updateData.mc_number = data.mcNumber
    if (data.serviceAreas !== undefined) updateData.service_areas = data.serviceAreas
    if (data.serviceCountries !== undefined) updateData.service_countries = data.serviceCountries
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.isActive !== undefined) updateData.is_active = data.isActive

    const { data: company, error } = await supabase
      .from("transport_companies")
      .update(updateData)
      .eq("id", id)
      .is("deleted_at", null)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Transport company not found" } as ErrorResponse,
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, data: mapCompanyRow(company) })
  } catch (error) {
    console.error("[transport-companies] Error updating company:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to update transport company",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * DELETE /api/v1/transport-companies/[id]
 * Soft delete a transport company
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
      .from("transport_companies")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, message: "Transport company deleted" })
  } catch (error) {
    console.error("[transport-companies] Error deleting company:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to delete transport company",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}
