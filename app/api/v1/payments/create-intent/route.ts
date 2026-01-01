import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createServerSupabaseClient, createAuthenticatedSupabaseClient } from "@/lib/supabase/server"
import type { ErrorResponse } from "@/types/api"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
})

interface CreateIntentRequest {
  amount: number
  warehouseId: string
  bookingDetails: {
    type: "pallet" | "area-rental"
    palletCount?: number
    areaSqFt?: number
    startDate: string
    endDate: string
    needTransportation?: boolean
    selectedPort?: string
    selectedContainerType?: string
    serviceIds?: string[]
  }
  customerEmail: string
  isGuest: boolean
}

/**
 * POST /api/v1/payments/create-intent
 * Create a Stripe payment intent for a booking
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[create-intent] Starting payment intent creation')
    console.log('[create-intent] STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY)
    console.log('[create-intent] STRIPE_SECRET_KEY length:', process.env.STRIPE_SECRET_KEY?.length || 0)

    const body = (await request.json()) as CreateIntentRequest
    console.log('[create-intent] Request body:', {
      amount: body.amount,
      warehouseId: body.warehouseId,
      type: body.bookingDetails?.type,
      isGuest: body.isGuest,
      hasEmail: !!body.customerEmail
    })

    if (!body.amount || body.amount <= 0) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Invalid amount",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    if (!body.customerEmail) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Customer email is required",
        statusCode: 400,
      }
      return NextResponse.json(errorData, { status: 400 })
    }

    // Get authenticated user ID and name if not a guest booking
    let userId: string | null = null
    let customerName: string = 'Guest User'

    if (!body.isGuest) {
      // Use authenticated client to read user session from cookies
      const authSupabase = await createAuthenticatedSupabaseClient()
      const { data: { user }, error: authError } = await authSupabase.auth.getUser()

      console.log('[create-intent] Auth check:', {
        hasUser: !!user,
        userId: user?.id,
        email: user?.email,
        authError: authError?.message
      })

      if (user) {
        userId = user.id

        // Get user's full name from profile
        const supabase = await createServerSupabaseClient()
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, first_name, last_name')
          .eq('id', user.id)
          .single()

        if (profile?.full_name) {
          customerName = profile.full_name
        } else if (profile?.first_name || profile?.last_name) {
          customerName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
        } else {
          // Fallback to email username
          customerName = user.email?.split('@')[0] || 'Customer'
        }
      } else {
        // If user is not authenticated, treat as guest booking
        console.log('[create-intent] No user found, treating as guest booking')
        body.isGuest = true
      }
    }

    // For guest bookings, extract name from email
    if (body.isGuest) {
      customerName = body.customerEmail.split('@')[0] || 'Guest User'
    }

    // Check warehouse availability before proceeding
    const supabase = await createServerSupabaseClient()
    const { data: warehouse, error: warehouseError } = await supabase
      .from('warehouses')
      .select('available_pallet_storage, available_sq_ft, city')
      .eq('id', body.warehouseId)
      .single()

    if (warehouseError) {
      console.error("[create-intent] Warehouse fetch error:", warehouseError)
      const errorData: ErrorResponse = {
        success: false,
        error: "Failed to fetch warehouse details",
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    // Validate availability
    if (body.bookingDetails.type === 'pallet' && body.bookingDetails.palletCount) {
      const availablePallets = warehouse.available_pallet_storage || 0
      if (body.bookingDetails.palletCount > availablePallets) {
        const errorData: ErrorResponse = {
          success: false,
          error: `Insufficient pallet capacity. Only ${availablePallets} pallets available, but ${body.bookingDetails.palletCount} requested.`,
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
    } else if (body.bookingDetails.type === 'area-rental' && body.bookingDetails.areaSqFt) {
      const availableSqFt = warehouse.available_sq_ft || 0
      if (body.bookingDetails.areaSqFt > availableSqFt) {
        const errorData: ErrorResponse = {
          success: false,
          error: `Insufficient space. Only ${availableSqFt} sq ft available, but ${body.bookingDetails.areaSqFt} sq ft requested.`,
          statusCode: 400,
        }
        return NextResponse.json(errorData, { status: 400 })
      }
    }

    // Create a Stripe customer (or get existing one)
    let stripeCustomerId: string
    const customers = await stripe.customers.list({
      email: body.customerEmail,
      limit: 1,
    })

    if (customers.data.length > 0) {
      stripeCustomerId = customers.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: body.customerEmail,
        metadata: {
          isGuest: body.isGuest.toString(),
        },
      })
      stripeCustomerId = customer.id
    }

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(body.amount * 100), // Convert to cents
      currency: "usd",
      customer: stripeCustomerId,
      metadata: {
        warehouseId: body.warehouseId,
        bookingType: body.bookingDetails.type,
        startDate: body.bookingDetails.startDate,
        endDate: body.bookingDetails.endDate,
      },
    })

    // Create a booking record with pending payment status in Supabase
    // Use server client (service role) to bypass RLS
    // Reuse supabase instance from availability check above

    // Generate unique booking ID
    console.log('[create-intent] Starting booking ID generation, warehouse.city:', warehouse.city)
    
    if (!warehouse.city) {
      console.error('[create-intent] Warehouse city is missing')
      const errorData: ErrorResponse = {
        success: false,
        error: "Warehouse city not found",
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    let bookingId: string
    try {
      const { generateUniqueBookingId } = await import('@/lib/utils/booking-id')
      bookingId = await generateUniqueBookingId({
        city: warehouse.city,
        type: body.bookingDetails.type,
        startDate: body.bookingDetails.startDate,
        endDate: body.bookingDetails.endDate,
      })
      console.log('[create-intent] Generated booking ID:', bookingId)
    } catch (error) {
      console.error('[create-intent] Error generating booking ID:', error)
      const errorData: ErrorResponse = {
        success: false,
        error: `Failed to generate booking ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    if (!bookingId || bookingId.trim() === '') {
      console.error('[create-intent] Generated booking ID is empty')
      const errorData: ErrorResponse = {
        success: false,
        error: "Failed to generate booking ID",
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    // Build metadata object
    const metadata: any = {}
    if (body.bookingDetails.needTransportation) {
      metadata.needTransportation = body.bookingDetails.needTransportation
      if (body.bookingDetails.selectedPort) {
        metadata.selectedPort = body.bookingDetails.selectedPort
      }
      if (body.bookingDetails.selectedContainerType) {
        metadata.selectedContainerType = body.bookingDetails.selectedContainerType
      }
    }
    if (body.bookingDetails.serviceIds && body.bookingDetails.serviceIds.length > 0) {
      metadata.serviceIds = body.bookingDetails.serviceIds
    }

    const bookingData: any = {
      id: bookingId,
      customer_name: customerName,
      customer_email: body.customerEmail,
      warehouse_id: body.warehouseId,
      type: body.bookingDetails.type,
      pallet_count: body.bookingDetails.palletCount,
      area_sq_ft: body.bookingDetails.areaSqFt,
      start_date: body.bookingDetails.startDate,
      end_date: body.bookingDetails.endDate,
      total_amount: body.amount,
      status: true, // Soft delete flag (active booking)
      booking_status: body.bookingDetails.type === "pallet" ? "pre_order" : "payment_pending",
      payment_status: "processing",
      payment_intent_id: paymentIntent.id,
      stripe_customer_id: stripeCustomerId,
      is_guest_booking: body.isGuest,
      guest_email: body.isGuest ? body.customerEmail : null,
      amount_due: body.amount,
    }

    // Add metadata only if it has content
    if (Object.keys(metadata).length > 0) {
      bookingData.metadata = metadata
    }

    // Add customer_id only if user is authenticated
    if (userId) {
      bookingData.customer_id = userId
    }

    console.log('[create-intent] Creating booking:', {
      bookingId: bookingData.id,
      hasCustomerId: !!userId,
      customerName: customerName,
      isGuest: body.isGuest,
      hasGuestEmail: !!bookingData.guest_email,
      bookingDataKeys: Object.keys(bookingData)
    })

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert(bookingData)
      .select()
      .single()

    if (bookingError) {
      console.error("[create-intent] Booking creation error:", bookingError)
      console.error("[create-intent] Booking data that failed:", bookingData)
      const errorData: ErrorResponse = {
        success: false,
        error: `Failed to create booking: ${bookingError.message}`,
        statusCode: 500,
      }
      return NextResponse.json(errorData, { status: 500 })
    }

    console.log('[create-intent] Booking created successfully:', booking.id)

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      bookingId: booking.id,
    })
  } catch (error) {
    console.error("[create-intent] Payment intent creation error:", error)
    console.error("[create-intent] Error stack:", error instanceof Error ? error.stack : 'No stack trace')
    const errorData: ErrorResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create payment intent",
      statusCode: 500,
    }
    return NextResponse.json(errorData, { status: 500 })
  }
}
