import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import type { PaginatedResponse } from "@/types"
import type { TransportCompany, TransportCompanyType } from "@/types"
import { z } from "zod"

const createTransportCompanySchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyType: z.enum(["local", "international", "end_delivery"]),
  taxNumber: z.string().optional(),
  registrationNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default("USA"),
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
})

/**
 * GET /api/v1/transport-companies
 * List transport companies with pagination and filters
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
    const companyType = searchParams.get("companyType") as TransportCompanyType | null
    const search = searchParams.get("search")
    const isActive = searchParams.get("isActive")

    const offset = (page - 1) * pageSize

    let query = supabase
      .from("transport_companies")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (companyType) {
      query = query.eq("company_type", companyType)
    }

    if (isActive !== null) {
      query = query.eq("is_active", isActive === "true")
    }

    if (search) {
      query = query.or(`company_name.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`)
    }

    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw error
    }

    const companies: TransportCompany[] = (data || []).map(row => ({
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
    }))

    const response: PaginatedResponse<TransportCompany> = {
      items: companies,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error("[transport-companies] Error fetching companies:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to fetch transport companies",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * POST /api/v1/transport-companies
 * Create a new transport company
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
    const validationResult = createTransportCompanySchema.safeParse(body)

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

    const { data: company, error } = await supabase
      .from("transport_companies")
      .insert({
        company_name: data.companyName,
        company_type: data.companyType,
        tax_number: data.taxNumber,
        registration_number: data.registrationNumber,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        zip_code: data.zipCode,
        phone: data.phone,
        email: data.email || null,
        website: data.website || null,
        contact_person_name: data.contactPersonName,
        contact_person_phone: data.contactPersonPhone,
        contact_person_email: data.contactPersonEmail || null,
        license_number: data.licenseNumber,
        license_expiry: data.licenseExpiry,
        insurance_number: data.insuranceNumber,
        insurance_expiry: data.insuranceExpiry,
        dot_number: data.dotNumber,
        mc_number: data.mcNumber,
        service_areas: data.serviceAreas,
        service_countries: data.serviceCountries,
        notes: data.notes,
        is_active: true,
        is_verified: false,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    const responseCompany: TransportCompany = {
      id: company.id,
      companyName: company.company_name,
      companyType: company.company_type,
      taxNumber: company.tax_number,
      registrationNumber: company.registration_number,
      address: company.address,
      city: company.city,
      state: company.state,
      country: company.country,
      zipCode: company.zip_code,
      phone: company.phone,
      email: company.email,
      website: company.website,
      contactPersonName: company.contact_person_name,
      contactPersonPhone: company.contact_person_phone,
      contactPersonEmail: company.contact_person_email,
      licenseNumber: company.license_number,
      licenseExpiry: company.license_expiry,
      insuranceNumber: company.insurance_number,
      insuranceExpiry: company.insurance_expiry,
      dotNumber: company.dot_number,
      mcNumber: company.mc_number,
      serviceAreas: company.service_areas,
      serviceCountries: company.service_countries,
      userId: company.user_id,
      isActive: company.is_active,
      isVerified: company.is_verified,
      verifiedAt: company.verified_at,
      verifiedBy: company.verified_by,
      notes: company.notes,
      metadata: company.metadata,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    }

    return NextResponse.json({ success: true, data: responseCompany }, { status: 201 })
  } catch (error) {
    console.error("[transport-companies] Error creating company:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to create transport company",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}
