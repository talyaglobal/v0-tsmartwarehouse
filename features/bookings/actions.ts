'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getEventEmitter } from '@/lib/events/event-emitter'
import type {
  BookingRequestedPayload,
  BookingProposalCreatedPayload,
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

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email, company_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    // Get warehouse owner
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('owner_company_id')
      .eq('id', input.warehouseId)
      .single()

    if (!warehouse) {
      return { success: false, error: 'Warehouse not found' }
    }

    // Create booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        customer_id: profile.id,
        customer_name: profile.name,
        customer_email: profile.email,
        warehouse_id: input.warehouseId,
        type: input.type,
        status: 'pending',
        pallet_count: input.palletCount,
        area_sq_ft: input.areaSqFt,
        start_date: input.startDate,
        end_date: input.endDate,
        total_amount: 0, // Will be set when proposal is accepted
        notes: input.notes,
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
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
    } as BookingProposalCreatedPayload)

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
