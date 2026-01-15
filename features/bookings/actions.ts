'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getEventEmitter } from '@/lib/events/event-emitter'
import type {
  BookingRequestedPayload,
  BookingProposalCreatedPayload,
  BookingProposalAcceptedPayload,
  BookingApprovedPayload,
  BookingRejectedPayload,
} from '@/lib/events/types'

/**
 * Create booking request
 */
export async function createBookingRequest(input: {
  warehouseId: string
  type: 'pallet' | 'area-rental'
  palletCount?: number
  areaSqFt?: number
  startDate: string
  endDate?: string
  notes?: string
  serviceIds?: string[]
  metadata?: Record<string, any>
  palletDetails?: Record<string, any>
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Use authenticated client to read user session from cookies
    const { createAuthenticatedSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = await createAuthenticatedSupabaseClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Auth error:', authError)
      return { success: false, error: 'Unauthorized. Please log in to create a booking.' }
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email, company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Get warehouse owner and city
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('owner_company_id, city, name')
      .eq('id', input.warehouseId)
      .single()

    if (!warehouse) {
      return { success: false, error: 'Warehouse not found' }
    }

    // Generate unique booking ID
    const { generateUniqueBookingId } = await import('@/lib/utils/booking-id')
    const bookingId = await generateUniqueBookingId({
      city: warehouse.city || 'UNK',
      startDate: input.startDate,
      endDate: input.endDate || input.startDate,
      type: input.type,
    })

    // Determine booking status: pending for all bookings (customer selects date/time)
    const bookingStatus = 'pending'

    // Calculate base price
    let baseTotal = 0
    try {
      const { calculatePrice } = await import('@/lib/services/pricing')
      const quantity = input.type === 'pallet' ? (input.palletCount || 0) : (input.areaSqFt || 0)
      const priceBreakdown = await calculatePrice({
        warehouse_id: input.warehouseId,
        type: input.type,
        quantity,
        start_date: input.startDate,
        end_date: input.endDate || input.startDate,
        pallet_details: input.palletDetails as any,
      })
      baseTotal = priceBreakdown.total
    } catch (error) {
      console.error('Error calculating price:', error)
      // Continue with 0 if price calculation fails
    }

    // Calculate services total
    let servicesTotal = 0
    if (input.serviceIds && input.serviceIds.length > 0) {
      const { data: services } = await supabase
        .from('warehouse_services')
        .select('*')
        .in('id', input.serviceIds)
        .eq('warehouse_id', input.warehouseId)
        .eq('is_active', true)

      if (services && services.length > 0) {
        servicesTotal = services.reduce((total, service) => {
          let servicePrice = parseFloat(service.base_price)

          // Calculate price based on pricing type
          if (service.pricing_type === 'per_pallet' && input.palletCount) {
            servicePrice = parseFloat(service.base_price) * input.palletCount
          } else if (service.pricing_type === 'per_sqft' && input.areaSqFt) {
            servicePrice = parseFloat(service.base_price) * input.areaSqFt
          } else if (service.pricing_type === 'per_day') {
            const start = new Date(input.startDate)
            const end = new Date(input.endDate || input.startDate)
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1
            servicePrice = parseFloat(service.base_price) * days
          } else if (service.pricing_type === 'per_month') {
            const start = new Date(input.startDate)
            const end = new Date(input.endDate || input.startDate)
            const months = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)) || 1
            servicePrice = parseFloat(service.base_price) * months
          }

          return total + servicePrice
        }, 0)
      }
    }

    const totalAmount = baseTotal + servicesTotal

    // Create booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        id: bookingId,
        customer_id: profile.id,
        customer_name: profile.name,
        customer_email: profile.email,
        warehouse_id: input.warehouseId,
        type: input.type,
        booking_status: bookingStatus,
        pallet_count: input.palletCount,
        area_sq_ft: input.areaSqFt,
        start_date: input.startDate,
        end_date: input.endDate,
        total_amount: totalAmount,
        notes: input.notes,
        metadata: input.metadata || {},
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Add selected services to booking_services table
    if (input.serviceIds && input.serviceIds.length > 0) {
      // Fetch service details for snapshot
      const { data: services } = await supabase
        .from('warehouse_services')
        .select('*')
        .in('id', input.serviceIds)
        .eq('warehouse_id', input.warehouseId)
        .eq('is_active', true)

      if (services && services.length > 0) {
        // Calculate service prices based on booking details
        const bookingServices = services.map((service) => {
          let calculatedPrice = parseFloat(service.base_price)

          // Calculate price based on pricing type
          if (service.pricing_type === 'per_pallet' && input.palletCount) {
            calculatedPrice = parseFloat(service.base_price) * input.palletCount
          } else if (service.pricing_type === 'per_sqft' && input.areaSqFt) {
            calculatedPrice = parseFloat(service.base_price) * input.areaSqFt
          } else if (service.pricing_type === 'per_day') {
            const start = new Date(input.startDate)
            const end = new Date(input.endDate || input.startDate)
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1
            calculatedPrice = parseFloat(service.base_price) * days
          } else if (service.pricing_type === 'per_month') {
            const start = new Date(input.startDate)
            const end = new Date(input.endDate || input.startDate)
            const months = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)) || 1
            calculatedPrice = parseFloat(service.base_price) * months
          }

          return {
            booking_id: booking.id,
            service_id: service.id,
            service_name: service.service_name,
            service_description: service.service_description,
            pricing_type: service.pricing_type,
            base_price: parseFloat(service.base_price),
            quantity: 1,
            calculated_price: calculatedPrice,
          }
        })

        // Insert booking services
        const { error: servicesError } = await supabase
          .from('booking_services')
          .insert(bookingServices)

        if (servicesError) {
          console.error('Error adding services to booking:', servicesError)
          console.error('Services error details:', {
            message: servicesError.message,
            code: servicesError.code,
            details: servicesError.details,
            hint: servicesError.hint,
          })
          // Don't fail the booking creation if services fail
        }
      }
    }

    // Emit booking requested event
    const emitter = getEventEmitter()
    await emitter.emit({
      eventType: 'booking.requested',
      entityType: 'booking',
      entityId: booking.id,
      bookingId: booking.id,
      customerId: profile.id,
      warehouseId: input.warehouseId,
      warehouseOwnerId: warehouse.owner_company_id,
      bookingType: input.type,
      palletCount: input.palletCount,
      areaSqFt: input.areaSqFt,
      timestamp: new Date().toISOString(),
    } as BookingRequestedPayload)

    // Send notifications to warehouse owner and admin
    const { getNotificationService } = await import('@/lib/notifications/service')
    const notificationService = getNotificationService()
    
    const { data: companyUsers } = await supabase
      .from('profiles')
      .select('id, email, name')
      .eq('company_id', warehouse.owner_company_id)
      .in('role', ['warehouse_admin', 'warehouse_supervisor'])

    if (companyUsers) {
      for (const user of companyUsers) {
        await notificationService.sendNotification({
          userId: user.id,
          type: 'booking',
          title: 'New Booking Received',
          message: `New booking ${booking.id} from ${profile.name || profile.email} for warehouse ${warehouse.name || input.warehouseId}`,
          channels: ['email', 'push'],
          metadata: {
            bookingId: booking.id,
            customerId: profile.id,
            customerName: profile.name || profile.email,
            warehouseId: input.warehouseId,
            warehouseName: warehouse.name,
            bookingType: input.type,
            palletCount: input.palletCount,
            areaSqFt: input.areaSqFt,
          },
        })
      }
    }

    revalidatePath('/dashboard/bookings')
    return { success: true, data: booking }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create booking proposal (warehouse owner)
 */
export async function createBookingProposal(input: {
  bookingId: string
  proposedPrice: number
  terms?: Record<string, any>
  expiresAt?: string
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, warehouses!inner(owner_company_id)')
      .eq('id', input.bookingId)
      .single()

    if (!booking) {
      return { success: false, error: 'Booking not found' }
    }

    // Verify user is warehouse owner
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profile?.company_id !== booking.warehouses.owner_company_id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Create proposal
    const { data: proposal, error } = await supabase
      .from('booking_proposals')
      .insert({
        booking_id: input.bookingId,
        proposed_by: user.id,
        proposed_price: input.proposedPrice,
        terms: input.terms || {},
        status: 'pending',
        expires_at: input.expiresAt,
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Update booking with proposal_id
    await supabase
      .from('bookings')
      .update({ proposal_id: proposal.id })
      .eq('id', input.bookingId)

    // Emit proposal created event
    const emitter = getEventEmitter()
    await emitter.emit({
      eventType: 'booking.proposal.created',
      entityType: 'proposal',
      entityId: proposal.id,
      proposalId: proposal.id,
      bookingId: input.bookingId,
      customerId: booking.customer_id,
      warehouseOwnerId: booking.warehouses.owner_company_id,
      proposedPrice: input.proposedPrice,
      expiresAt: input.expiresAt || '',
      timestamp: new Date().toISOString(),
    } as BookingProposalCreatedPayload)

    revalidatePath(`/warehouse-owner/bookings`)
    return { success: true, data: proposal }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Accept booking proposal (customer)
 */
export async function acceptBookingProposal(
  proposalId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get proposal and booking
    const { data: proposal } = await supabase
      .from('booking_proposals')
      .select('*, bookings!inner(customer_id, warehouse_id, warehouses!inner(owner_company_id))')
      .eq('id', proposalId)
      .single()

    if (!proposal) {
      return { success: false, error: 'Proposal not found' }
    }

    // Verify user is customer
    if (proposal.bookings.customer_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update proposal status
    const { error } = await supabase
      .from('booking_proposals')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', proposalId)

    if (error) {
      return { success: false, error: error.message }
    }

    // Update booking total amount
    await supabase
      .from('bookings')
      .update({ total_amount: proposal.proposed_price })
      .eq('id', proposal.bookings.id)

    // Emit proposal accepted event
    const emitter = getEventEmitter()
    await emitter.emit({
      eventType: 'booking.proposal.accepted',
      entityType: 'proposal',
      entityId: proposal.id,
      proposalId: proposal.id,
      bookingId: proposal.bookings.id,
      customerId: proposal.bookings.customer_id,
      warehouseOwnerId: proposal.bookings.warehouses.owner_company_id,
      timestamp: new Date().toISOString(),
    } as BookingProposalAcceptedPayload)

    revalidatePath('/dashboard/bookings')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Reject booking proposal (customer)
 */
export async function rejectBookingProposal(
  proposalId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get proposal and booking
    const { data: proposal } = await supabase
      .from('booking_proposals')
      .select('*, bookings!inner(customer_id, warehouse_id, warehouses!inner(owner_company_id))')
      .eq('id', proposalId)
      .single()

    if (!proposal) {
      return { success: false, error: 'Proposal not found' }
    }

    // Verify user is customer
    if (proposal.bookings.customer_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update proposal status
    const { error } = await supabase
      .from('booking_proposals')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', proposalId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/bookings')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Approve booking (warehouse owner)
 */
export async function approveBooking(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, warehouses!inner(owner_company_id)')
      .eq('id', bookingId)
      .single()

    if (!booking) {
      return { success: false, error: 'Booking not found' }
    }

    // Verify user is warehouse owner
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profile?.company_id !== booking.warehouses.owner_company_id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update booking status
    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', bookingId)

    if (error) {
      return { success: false, error: error.message }
    }

    // Get warehouse staff for notification
    const { data: staff } = await supabase
      .from('warehouse_staff')
      .select('user_id')
      .eq('warehouse_id', booking.warehouse_id)

    const staffIds = staff?.map((s) => s.user_id) || []

    // Emit booking approved event
    const emitter = getEventEmitter()
    await emitter.emit({
      eventType: 'booking.approved',
      entityType: 'booking',
      entityId: bookingId,
      bookingId: bookingId,
      customerId: booking.customer_id,
      warehouseId: booking.warehouse_id,
      warehouseOwnerId: booking.warehouses.owner_company_id,
      warehouseStaffIds: staffIds,
      timestamp: new Date().toISOString(),
    } as BookingApprovedPayload)

    revalidatePath('/warehouse-owner/bookings')
    revalidatePath('/dashboard/bookings')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Reject booking (warehouse owner)
 */
export async function rejectBooking(
  bookingId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, warehouses!inner(owner_company_id)')
      .eq('id', bookingId)
      .single()

    if (!booking) {
      return { success: false, error: 'Booking not found' }
    }

    // Verify user is warehouse owner
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profile?.company_id !== booking.warehouses.owner_company_id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update booking status
    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        notes: reason ? `${booking.notes || ''}\nRejection reason: ${reason}`.trim() : booking.notes,
      })
      .eq('id', bookingId)

    if (error) {
      return { success: false, error: error.message }
    }

    // Emit booking rejected event
    const emitter = getEventEmitter()
    await emitter.emit({
      eventType: 'booking.rejected',
      entityType: 'booking',
      entityId: bookingId,
      bookingId: bookingId,
      customerId: booking.customer_id,
      warehouseOwnerId: booking.warehouses.owner_company_id,
      reason: reason,
      timestamp: new Date().toISOString(),
    } as BookingRejectedPayload)

    revalidatePath('/warehouse-owner/bookings')
    revalidatePath('/dashboard/bookings')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Cancel booking (customer)
 */
export async function cancelBookingAction(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (!booking) {
      return { success: false, error: 'Booking not found' }
    }

    // Verify user is customer
    if (booking.customer_id !== user.id) {
      return { success: false, error: 'Unauthorized' }
    }

    // Update booking status
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/bookings')
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
