import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import type { PaginatedResponse } from "@/types"
import type { Shipment, ShipmentStatus, ShipmentType } from "@/types"
import { z } from "zod"

const createShipmentSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
  shipmentType: z.enum(["inbound", "outbound", "transfer"]),
  localTransportId: z.string().uuid().optional(),
  internationalTransportId: z.string().uuid().optional(),
  endDeliveryPartyId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  // Origin
  originAddress: z.string().optional(),
  originCity: z.string().optional(),
  originState: z.string().optional(),
  originCountry: z.string().optional(),
  originZip: z.string().optional(),
  originContactName: z.string().optional(),
  originContactPhone: z.string().optional(),
  // Destination
  destinationAddress: z.string().optional(),
  destinationCity: z.string().optional(),
  destinationState: z.string().optional(),
  destinationCountry: z.string().optional(),
  destinationZip: z.string().optional(),
  destinationContactName: z.string().optional(),
  destinationContactPhone: z.string().optional(),
  // Cargo
  cargoDescription: z.string().optional(),
  totalWeight: z.number().optional(),
  weightUnit: z.string().default("kg"),
  totalVolume: z.number().optional(),
  volumeUnit: z.string().default("cbm"),
  palletCount: z.number().optional(),
  packageCount: z.number().optional(),
  // Special Requirements
  isHazmat: z.boolean().default(false),
  hazmatClass: z.string().optional(),
  requiresRefrigeration: z.boolean().default(false),
  temperatureRequirement: z.object({
    min: z.number(),
    max: z.number(),
    unit: z.string(),
  }).optional(),
  specialHandling: z.string().optional(),
  // Scheduling
  scheduledPickupDate: z.string().optional(),
  scheduledPickupTime: z.string().optional(),
  scheduledDeliveryDate: z.string().optional(),
  scheduledDeliveryTime: z.string().optional(),
  estimatedTransitDays: z.number().optional(),
  // Costs
  transportCost: z.number().optional(),
  customsCost: z.number().optional(),
  insuranceCost: z.number().optional(),
  otherCosts: z.number().optional(),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
})

function mapShipmentRow(row: any): Shipment {
  return {
    id: row.id,
    shipmentNumber: row.shipment_number,
    bookingId: row.booking_id,
    shipmentType: row.shipment_type,
    localTransportId: row.local_transport_id,
    internationalTransportId: row.international_transport_id,
    endDeliveryPartyId: row.end_delivery_party_id,
    driverId: row.driver_id,
    vehicleId: row.vehicle_id,
    originAddress: row.origin_address,
    originCity: row.origin_city,
    originState: row.origin_state,
    originCountry: row.origin_country,
    originZip: row.origin_zip,
    originLatitude: row.origin_latitude,
    originLongitude: row.origin_longitude,
    originContactName: row.origin_contact_name,
    originContactPhone: row.origin_contact_phone,
    destinationAddress: row.destination_address,
    destinationCity: row.destination_city,
    destinationState: row.destination_state,
    destinationCountry: row.destination_country,
    destinationZip: row.destination_zip,
    destinationLatitude: row.destination_latitude,
    destinationLongitude: row.destination_longitude,
    destinationContactName: row.destination_contact_name,
    destinationContactPhone: row.destination_contact_phone,
    cargoDescription: row.cargo_description,
    totalWeight: row.total_weight,
    weightUnit: row.weight_unit,
    totalVolume: row.total_volume,
    volumeUnit: row.volume_unit,
    palletCount: row.pallet_count,
    packageCount: row.package_count,
    isHazmat: row.is_hazmat,
    hazmatClass: row.hazmat_class,
    requiresRefrigeration: row.requires_refrigeration,
    temperatureRequirement: row.temperature_requirement,
    specialHandling: row.special_handling,
    scheduledPickupDate: row.scheduled_pickup_date,
    scheduledPickupTime: row.scheduled_pickup_time,
    actualPickupAt: row.actual_pickup_at,
    scheduledDeliveryDate: row.scheduled_delivery_date,
    scheduledDeliveryTime: row.scheduled_delivery_time,
    actualDeliveryAt: row.actual_delivery_at,
    estimatedTransitDays: row.estimated_transit_days,
    status: row.status,
    statusHistory: row.status_history,
    customsStatus: row.customs_status,
    customsDeclarationNumber: row.customs_declaration_number,
    customsClearedAt: row.customs_cleared_at,
    podSignatureUrl: row.pod_signature_url,
    podPhotoUrls: row.pod_photo_urls,
    podReceivedBy: row.pod_received_by,
    podNotes: row.pod_notes,
    transportCost: row.transport_cost,
    customsCost: row.customs_cost,
    insuranceCost: row.insurance_cost,
    otherCosts: row.other_costs,
    totalCost: row.total_cost,
    currency: row.currency,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    currentLatitude: row.current_latitude,
    currentLongitude: row.current_longitude,
    lastTrackingUpdate: row.last_tracking_update,
    notes: row.notes,
    internalNotes: row.internal_notes,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  }
}

/**
 * GET /api/v1/shipments
 * List shipments with pagination and filters
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
    const bookingId = searchParams.get("bookingId")
    const status = searchParams.get("status") as ShipmentStatus | null
    const shipmentType = searchParams.get("shipmentType") as ShipmentType | null
    const localTransportId = searchParams.get("localTransportId")
    const driverId = searchParams.get("driverId")

    const offset = (page - 1) * pageSize

    let query = supabase
      .from("shipments")
      .select(`
        *,
        local_transport:transport_companies!local_transport_id (
          id,
          company_name,
          company_type
        ),
        international_transport:transport_companies!international_transport_id (
          id,
          company_name,
          company_type
        ),
        end_delivery:transport_companies!end_delivery_party_id (
          id,
          company_name,
          company_type
        ),
        driver:transport_drivers (
          id,
          full_name,
          phone,
          license_plate
        )
      `, { count: "exact" })
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    if (bookingId) {
      query = query.eq("booking_id", bookingId)
    }

    if (status) {
      query = query.eq("status", status)
    }

    if (shipmentType) {
      query = query.eq("shipment_type", shipmentType)
    }

    if (localTransportId) {
      query = query.eq("local_transport_id", localTransportId)
    }

    if (driverId) {
      query = query.eq("driver_id", driverId)
    }

    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw error
    }

    const shipments: Shipment[] = (data || []).map(row => {
      const shipment = mapShipmentRow(row)
      if (row.local_transport) {
        shipment.localTransport = {
          id: row.local_transport.id,
          companyName: row.local_transport.company_name,
          companyType: row.local_transport.company_type,
          isActive: true,
          isVerified: false,
          createdAt: "",
          updatedAt: "",
        }
      }
      if (row.international_transport) {
        shipment.internationalTransport = {
          id: row.international_transport.id,
          companyName: row.international_transport.company_name,
          companyType: row.international_transport.company_type,
          isActive: true,
          isVerified: false,
          createdAt: "",
          updatedAt: "",
        }
      }
      if (row.end_delivery) {
        shipment.endDeliveryParty = {
          id: row.end_delivery.id,
          companyName: row.end_delivery.company_name,
          companyType: row.end_delivery.company_type,
          isActive: true,
          isVerified: false,
          createdAt: "",
          updatedAt: "",
        }
      }
      if (row.driver) {
        shipment.driver = {
          id: row.driver.id,
          fullName: row.driver.full_name,
          phone: row.driver.phone,
          licensePlate: row.driver.license_plate,
          transportCompanyId: "",
          licenseNumber: "",
          hazmatCertified: false,
          twicCard: false,
          isActive: true,
          availabilityStatus: "available",
          createdAt: "",
          updatedAt: "",
        }
      }
      return shipment
    })

    const response: PaginatedResponse<Shipment> = {
      items: shipments,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error("[shipments] Error fetching shipments:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to fetch shipments",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * POST /api/v1/shipments
 * Create a new shipment
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
    const validationResult = createShipmentSchema.safeParse(body)

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

    // Verify booking exists
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id")
      .eq("id", data.bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" } as ErrorResponse,
        { status: 404 }
      )
    }

    // Calculate total cost
    const totalCost = (data.transportCost || 0) + 
                      (data.customsCost || 0) + 
                      (data.insuranceCost || 0) + 
                      (data.otherCosts || 0)

    const { data: shipment, error } = await supabase
      .from("shipments")
      .insert({
        booking_id: data.bookingId,
        shipment_type: data.shipmentType,
        local_transport_id: data.localTransportId,
        international_transport_id: data.internationalTransportId,
        end_delivery_party_id: data.endDeliveryPartyId,
        driver_id: data.driverId,
        vehicle_id: data.vehicleId,
        origin_address: data.originAddress,
        origin_city: data.originCity,
        origin_state: data.originState,
        origin_country: data.originCountry,
        origin_zip: data.originZip,
        origin_contact_name: data.originContactName,
        origin_contact_phone: data.originContactPhone,
        destination_address: data.destinationAddress,
        destination_city: data.destinationCity,
        destination_state: data.destinationState,
        destination_country: data.destinationCountry,
        destination_zip: data.destinationZip,
        destination_contact_name: data.destinationContactName,
        destination_contact_phone: data.destinationContactPhone,
        cargo_description: data.cargoDescription,
        total_weight: data.totalWeight,
        weight_unit: data.weightUnit,
        total_volume: data.totalVolume,
        volume_unit: data.volumeUnit,
        pallet_count: data.palletCount,
        package_count: data.packageCount,
        is_hazmat: data.isHazmat,
        hazmat_class: data.hazmatClass,
        requires_refrigeration: data.requiresRefrigeration,
        temperature_requirement: data.temperatureRequirement,
        special_handling: data.specialHandling,
        scheduled_pickup_date: data.scheduledPickupDate,
        scheduled_pickup_time: data.scheduledPickupTime,
        scheduled_delivery_date: data.scheduledDeliveryDate,
        scheduled_delivery_time: data.scheduledDeliveryTime,
        estimated_transit_days: data.estimatedTransitDays,
        transport_cost: data.transportCost,
        customs_cost: data.customsCost,
        insurance_cost: data.insuranceCost,
        other_costs: data.otherCosts,
        total_cost: totalCost,
        currency: data.currency,
        notes: data.notes,
        status: "pending",
        status_history: [{ status: "pending", timestamp: new Date().toISOString() }],
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data: mapShipmentRow(shipment) }, { status: 201 })
  } catch (error) {
    console.error("[shipments] Error creating shipment:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to create shipment",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}
