import { type NextRequest, NextResponse } from "next/server"
import { getBookings, createBooking } from "@/lib/db/bookings"
import { PRICING } from "@/lib/constants"
import { getFreeStorageDays } from "@/lib/utils/free-storage"
import { requireAuth } from "@/lib/auth/api-middleware"
import { isCompanyAdmin, getUserCompanyId } from "@/lib/auth/company-admin"
import { handleApiError } from "@/lib/utils/logger"
import { setCacheHeaders } from "@/lib/cache/api-cache"
import { createBookingSchema, bookingsQuerySchema } from "@/lib/validation/schemas"
import type { BookingStatus, BookingType } from "@/types"
import type { BookingsListResponse, BookingResponse, ErrorResponse } from "@/types/api"

// Enable caching for GET requests (5 minutes)
export const revalidate = 300

export async function GET(request: NextRequest) {
  try {
    // Try to get authenticated user (optional for GET - allows public access with customerId param)
    const authResult = await requireAuth(request)
    let authenticatedUserId: string | undefined = undefined

    if (!(authResult instanceof NextResponse)) {
      // User is authenticated, use their ID as default filter
      authenticatedUserId = authResult.user.id
    } else {
      return authResult
    }

    const { searchParams } = new URL(request.url)

    // Validate query parameters
    const queryParams: Record<string, string | undefined> = {}
    searchParams.forEach((value, key) => {
      queryParams[key] = value
    })

    let validatedParams
    try {
      validatedParams = bookingsQuerySchema.parse(queryParams)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        const errorData: ErrorResponse = {
          success: false,
          error: "Invalid query parameters",
          statusCode: 400,
          code: "VALIDATION_ERROR",
          details: zodError.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", "),
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    const filters: {
      customerId?: string
      companyId?: string
      warehouseCompanyId?: string
      status?: BookingStatus
      type?: BookingType
      warehouseId?: string
      limit?: number
      offset?: number
      useCache?: boolean
    } = {}

    // Check if user is company admin
    let userCompanyId: string | null = null
    let isAdmin = false
    if (authenticatedUserId) {
      userCompanyId = await getUserCompanyId(authenticatedUserId)
      if (userCompanyId) {
        isAdmin = await isCompanyAdmin(authenticatedUserId, userCompanyId)
      }
    }

    // If authenticated and no customerId specified
    if (validatedParams.customerId) {
      // If user is company admin, they can see bookings of users in their company
      if (isAdmin && userCompanyId) {
        // Verify the requested customerId belongs to the same company
        const { createServerSupabaseClient } = await import('@/lib/supabase/server')
        const supabase = createServerSupabaseClient()
        const { data: customerProfile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', validatedParams.customerId)
          .single()

        if (customerProfile?.company_id === userCompanyId) {
          filters.customerId = validatedParams.customerId
        } else {
          // Customer doesn't belong to admin's company
          filters.customerId = authenticatedUserId // Fallback to own bookings
        }
      } else {
        filters.customerId = validatedParams.customerId
      }
    } else if (authenticatedUserId && !validatedParams.warehouseCompanyId) {
      // Only set companyId filter if warehouseCompanyId is NOT being used
      // warehouseCompanyId filter is for viewing bookings TO company warehouses (from any customer)
      // companyId filter is for viewing bookings BY company users (to any warehouse)
      if (isAdmin && userCompanyId) {
        // Company admin - show all bookings from their company users
        filters.companyId = userCompanyId
      } else {
        // Regular user - show only their own bookings
        filters.customerId = authenticatedUserId
      }
    }
    
    if (validatedParams.warehouseCompanyId) {
      // Filter by warehouse company - verify user has permission
      if (authenticatedUserId && userCompanyId) {
        // User can only see bookings for their own company's warehouses
        if (validatedParams.warehouseCompanyId === userCompanyId) {
          filters.warehouseCompanyId = validatedParams.warehouseCompanyId
        }
      } else {
        // Unauthenticated or no company - reject
        filters.warehouseCompanyId = undefined
      }
    }
    
    if (validatedParams.status) filters.status = validatedParams.status
    if (validatedParams.type) filters.type = validatedParams.type
    if (validatedParams.warehouseId) filters.warehouseId = validatedParams.warehouseId
    if (validatedParams.limit) filters.limit = validatedParams.limit
    if (validatedParams.offset) filters.offset = validatedParams.offset

    // Disable cache for authenticated requests to ensure fresh data
    // Cache can cause issues when new bookings are created
    filters.useCache = false

    // Don't filter by status if not specified - get all bookings including pre_order, payment_pending, and cancelled
    const bookings = await getBookings(filters)
    
    // Return all bookings - customers should be able to see their cancelled bookings
    const filteredBookings = bookings

    const responseData: BookingsListResponse = {
      success: true,
      data: filteredBookings,
      total: filteredBookings.length,
    }

    const response = NextResponse.json(responseData)

    // Set cache headers
    return setCacheHeaders(response, 300, 60)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/bookings" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const body = await request.json()

    // Validate request body with Zod schema
    let validatedData
    try {
      validatedData = createBookingSchema.parse(body)
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

    const { type, palletCount, areaSqFt, hallId, startDate, endDate, notes } = validatedData
    const selectedServices = body.selectedServices || [] // Array of { serviceId: string, quantity?: number }

    // Get customer profile information
    const { createServerSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createServerSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      const errorData: ErrorResponse = {
        success: false,
        error: "User profile not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    // Get warehouse ID first
    let warehouseId = body.warehouseId || process.env.DEFAULT_WAREHOUSE_ID
    
    if (!warehouseId) {
      // Get first warehouse from database
      const { data: warehouses, error: warehouseError } = await supabase
        .from('warehouses')
        .select('id')
        .limit(1)
        .single()
      
      if (warehouseError || !warehouses) {
        // If no warehouse exists, create a default one
        const { data: newWarehouse, error: createError } = await supabase
          .from('warehouses')
          .insert({
            name: 'Warebnb - Main Facility',
            address: '735 S Front St',
            city: 'Elizabeth',
            state: 'NJ',
            zip_code: '07202',
            total_sq_ft: 240000,
          })
          .select('id')
          .single()
        
        if (createError || !newWarehouse) {
          const errorData: ErrorResponse = {
            success: false,
            error: "Failed to get or create warehouse",
            statusCode: 500,
            details: createError?.message || 'No warehouse found and failed to create default',
          }
          return NextResponse.json(errorData, { status: 500 })
        }
        
        warehouseId = newWarehouse.id
      } else {
        warehouseId = warehouses.id
      }
    }

    // Calculate pricing based on warehouse pricing table and date range
    let baseStorageAmount = 0

    // Fetch warehouse pricing
    const { data: pricingData, error: pricingError } = await supabase
      .from('warehouse_pricing')
      .select('pricing_type, base_price, unit')
      .eq('warehouse_id', warehouseId)
      .eq('status', true)

    if (pricingError) {
      console.error('Failed to fetch warehouse pricing:', pricingError)
    }

    const { data: warehouseData } = await supabase
      .from('warehouses')
      .select('free_storage_rules')
      .eq('id', warehouseId)
      .single()

    if (type === "pallet" && palletCount && startDate && endDate) {
      // Calculate days between start and end date
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffTime = Math.abs(end.getTime() - start.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      const freeDays = getFreeStorageDays(warehouseData?.free_storage_rules, diffDays)
      const billableDays = Math.max(0, diffDays - freeDays)
      const diffMonths = billableDays / 30 // Approximate months

      // Determine if we should use daily or monthly pricing
      // If booking is >= 30 days, use monthly pricing if available
      let pricePerUnit = 0
      const useMonthly = diffDays >= 30

      if (pricingData && pricingData.length > 0) {
        if (useMonthly) {
          // Try to find monthly pricing first
          const monthlyPricing = pricingData.find(p => p.pricing_type === 'pallet-monthly')
          if (monthlyPricing) {
            pricePerUnit = monthlyPricing.base_price
            baseStorageAmount = palletCount * pricePerUnit * diffMonths
          } else {
            // Fall back to daily pricing if monthly not available
            const dailyPricing = pricingData.find(p => p.pricing_type === 'pallet')
            if (dailyPricing) {
              pricePerUnit = dailyPricing.base_price
              baseStorageAmount = palletCount * pricePerUnit * billableDays
            }
          }
        } else {
          // Use daily pricing for short term
          const dailyPricing = pricingData.find(p => p.pricing_type === 'pallet')
          if (dailyPricing) {
            pricePerUnit = dailyPricing.base_price
            baseStorageAmount = palletCount * pricePerUnit * billableDays
          }
        }
      }

      // Fallback to old PRICING constant if no pricing found
      if (baseStorageAmount === 0) {
        const handlingIn = palletCount * PRICING.palletIn
        const storage = palletCount * PRICING.storagePerPalletPerMonth
        baseStorageAmount = handlingIn + storage
      }
    } else if (type === "area-rental" && areaSqFt) {
      if (areaSqFt < PRICING.areaRentalMinSqFt) {
        const errorData: ErrorResponse = {
          success: false,
          error: `Minimum area rental is ${PRICING.areaRentalMinSqFt} sq ft`,
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }

      // Use area pricing from warehouse_pricing table
      if (pricingData && pricingData.length > 0) {
        const areaPricing = pricingData.find(p => p.pricing_type === 'area')
        if (areaPricing && startDate && endDate) {
          const start = new Date(startDate)
          const end = new Date(endDate)
          const diffTime = Math.abs(end.getTime() - start.getTime())
          const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          const freeDays = getFreeStorageDays(warehouseData?.free_storage_rules, totalDays)
          const billableDays = Math.max(0, totalDays - freeDays)
          const diffMonths = Math.ceil(billableDays / 30)
          baseStorageAmount = areaSqFt * areaPricing.base_price * diffMonths
        } else {
          // Fallback to old pricing
          baseStorageAmount = areaSqFt * PRICING.areaRentalPerSqFtPerYear
        }
      } else {
        baseStorageAmount = areaSqFt * PRICING.areaRentalPerSqFtPerYear
      }
    }

    // Calculate service prices
    let servicesAmount = 0
    const bookingServicesData: Array<{
      service_id: string
      service_name: string
      pricing_type: string
      base_price: number
      quantity: number
      calculated_price: number
    }> = []

    if (selectedServices.length > 0 && startDate && endDate) {
      // Fetch selected services
      const serviceIds = selectedServices.map((s: any) => s.serviceId || s.id).filter(Boolean)
      if (serviceIds.length > 0) {
        const { data: services, error: servicesError } = await supabase
          .from('warehouse_services')
          .select('*')
          .eq('warehouse_id', warehouseId)
          .eq('is_active', true)
          .in('id', serviceIds)

        if (!servicesError && services) {
          const start = new Date(startDate)
          const end = new Date(endDate)
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          const months = Math.ceil(days / 30)

          for (const service of services) {
            const selectedService = selectedServices.find((s: any) => (s.serviceId || s.id) === service.id)
            const quantity = selectedService?.quantity || 1

            let calculatedPrice = 0
            switch (service.pricing_type) {
              case 'one_time':
                calculatedPrice = service.base_price
                break
              case 'per_pallet':
                calculatedPrice = service.base_price * (palletCount || 0) * quantity
                break
              case 'per_sqft':
                calculatedPrice = service.base_price * (areaSqFt || 0) * quantity
                break
              case 'per_day':
                calculatedPrice = service.base_price * days * quantity
                break
              case 'per_month':
                calculatedPrice = service.base_price * months * quantity
                break
            }

            servicesAmount += calculatedPrice
            bookingServicesData.push({
              service_id: service.id,
              service_name: service.service_name,
              pricing_type: service.pricing_type,
              base_price: service.base_price,
              quantity,
              calculated_price: calculatedPrice,
            })
          }
        }
      }
    }

    const totalAmount = baseStorageAmount + servicesAmount

    // Validate hallId if provided (must be UUID format)
    let validHallId: string | undefined = undefined
    if (type === "area-rental" && hallId) {
      // Check if hallId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (uuidRegex.test(hallId)) {
        validHallId = hallId
      } else {
        // If not UUID, try to find hall by name or skip it
        // For now, we'll skip it since hallId is optional
        console.warn(`Invalid hallId format: ${hallId}, skipping hall assignment`)
      }
    }

    // Create booking using database function
    const newBooking = await createBooking({
      customerId: user.id,
      customerName: profile.name || user.email,
      customerEmail: profile.email || user.email,
      warehouseId,
      type,
      status: "pending",
      palletCount: type === "pallet" ? palletCount : undefined,
      areaSqFt: type === "area-rental" ? areaSqFt : undefined,
      floorNumber: type === "area-rental" ? 3 : undefined,
      hallId: validHallId,
      startDate,
      endDate: endDate || undefined,
      totalAmount,
      baseStorageAmount,
      servicesAmount,
      notes: notes || undefined,
    })

    // Create booking_services records if services were selected
    if (bookingServicesData.length > 0) {
      const { error: servicesError } = await supabase
        .from('booking_services')
        .insert(
          bookingServicesData.map(bs => ({
            booking_id: newBooking.id,
            service_id: bs.service_id,
            service_name: bs.service_name,
            pricing_type: bs.pricing_type,
            base_price: bs.base_price,
            quantity: bs.quantity,
            calculated_price: bs.calculated_price,
          }))
        )

      if (servicesError) {
        console.error('Failed to create booking services:', servicesError)
        // Don't fail the booking creation, just log the error
      }
    }

    const responseData: BookingResponse = {
      success: true,
      data: newBooking,
      message: "Booking created successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/bookings", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
