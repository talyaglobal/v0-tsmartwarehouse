/**
 * Database operations for Booking Approvals
 * Handles approval workflow for on-behalf bookings
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { BookingApproval, BookingApprovalStatus } from '@/types'

// =====================================================
// Approval CRUD Operations
// =====================================================

interface GetApprovalsOptions {
  bookingId?: string
  requestedBy?: string
  customerId?: string
  status?: BookingApprovalStatus
  limit?: number
  offset?: number
}

/**
 * Get approvals with optional filters
 */
export async function getApprovals(filters?: GetApprovalsOptions): Promise<BookingApproval[]> {
  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('booking_approvals')
    .select(`
      *,
      bookings:booking_id (
        id,
        customer_id,
        customer_name,
        warehouse_id,
        type,
        start_date,
        total_amount,
        warehouses:warehouse_id (name)
      )
    `)

  if (filters?.bookingId) {
    query = query.eq('booking_id', filters.bookingId)
  }

  if (filters?.requestedBy) {
    query = query.eq('requested_by', filters.requestedBy)
  }

  if (filters?.customerId) {
    query = query.in('booking_id', 
      supabase
        .from('bookings')
        .select('id')
        .eq('customer_id', filters.customerId)
    )
  }

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.limit) {
    query = query.range(
      filters.offset || 0,
      (filters.offset || 0) + filters.limit - 1
    )
  }

  const { data, error } = await query.order('requested_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch approvals: ${error.message}`)
  }

  return (data || []).map(transformApprovalRow)
}

/**
 * Get approval by booking ID
 */
export async function getApprovalByBookingId(bookingId: string): Promise<BookingApproval | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('booking_approvals')
    .select(`
      *,
      bookings:booking_id (
        id,
        customer_id,
        customer_name,
        warehouse_id,
        type,
        start_date,
        total_amount,
        warehouses:warehouse_id (name)
      )
    `)
    .eq('booking_id', bookingId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch approval: ${error.message}`)
  }

  return transformApprovalRow(data)
}

/**
 * Get pending approvals for a user (as customer who needs to approve)
 */
export async function getPendingApprovalsForUser(userId: string): Promise<BookingApproval[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('booking_approvals')
    .select(`
      *,
      bookings:booking_id!inner (
        id,
        customer_id,
        customer_name,
        warehouse_id,
        type,
        start_date,
        total_amount,
        warehouses:warehouse_id (name)
      )
    `)
    .eq('bookings.customer_id', userId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch pending approvals: ${error.message}`)
  }

  return (data || []).map(transformApprovalRow)
}

/**
 * Get approvals requested by a user (as team admin)
 */
export async function getApprovalsRequestedBy(userId: string): Promise<BookingApproval[]> {
  return getApprovals({ requestedBy: userId })
}

/**
 * Create an approval request for a booking
 */
export async function createApprovalRequest(
  bookingId: string,
  requestedBy: string,
  requestedByName: string,
  requestMessage?: string,
  expiresAt?: string
): Promise<BookingApproval> {
  const supabase = await createServerSupabaseClient()

  // First, update the booking to mark it as requiring approval
  const { error: bookingError } = await supabase
    .from('bookings')
    .update({
      booked_on_behalf: true,
      requires_approval: true,
      approval_status: 'pending',
    })
    .eq('id', bookingId)

  if (bookingError) {
    throw new Error(`Failed to update booking: ${bookingError.message}`)
  }

  // Create the approval record
  const { data, error } = await supabase
    .from('booking_approvals')
    .insert({
      booking_id: bookingId,
      requested_by: requestedBy,
      requested_by_name: requestedByName,
      request_message: requestMessage,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select(`
      *,
      bookings:booking_id (
        id,
        customer_id,
        customer_name,
        warehouse_id,
        type,
        start_date,
        total_amount,
        warehouses:warehouse_id (name)
      )
    `)
    .single()

  if (error) {
    throw new Error(`Failed to create approval request: ${error.message}`)
  }

  return transformApprovalRow(data)
}

/**
 * Approve a booking
 */
export async function approveBooking(
  bookingId: string,
  respondedBy: string,
  respondedByName: string,
  responseMessage?: string
): Promise<BookingApproval> {
  const supabase = await createServerSupabaseClient()

  // Update approval record
  const { data, error } = await supabase
    .from('booking_approvals')
    .update({
      status: 'approved',
      responded_by: respondedBy,
      responded_by_name: respondedByName,
      response_message: responseMessage,
      responded_at: new Date().toISOString(),
    })
    .eq('booking_id', bookingId)
    .select(`
      *,
      bookings:booking_id (
        id,
        customer_id,
        customer_name,
        warehouse_id,
        type,
        start_date,
        total_amount,
        warehouses:warehouse_id (name)
      )
    `)
    .single()

  if (error) {
    throw new Error(`Failed to approve booking: ${error.message}`)
  }

  // Update booking status
  await supabase
    .from('bookings')
    .update({ approval_status: 'approved' })
    .eq('id', bookingId)

  return transformApprovalRow(data)
}

/**
 * Reject a booking
 */
export async function rejectBooking(
  bookingId: string,
  respondedBy: string,
  respondedByName: string,
  responseMessage?: string
): Promise<BookingApproval> {
  const supabase = await createServerSupabaseClient()

  // Update approval record
  const { data, error } = await supabase
    .from('booking_approvals')
    .update({
      status: 'rejected',
      responded_by: respondedBy,
      responded_by_name: respondedByName,
      response_message: responseMessage,
      responded_at: new Date().toISOString(),
    })
    .eq('booking_id', bookingId)
    .select(`
      *,
      bookings:booking_id (
        id,
        customer_id,
        customer_name,
        warehouse_id,
        type,
        start_date,
        total_amount,
        warehouses:warehouse_id (name)
      )
    `)
    .single()

  if (error) {
    throw new Error(`Failed to reject booking: ${error.message}`)
  }

  // Update booking status to rejected and cancelled
  await supabase
    .from('bookings')
    .update({ 
      approval_status: 'rejected',
      booking_status: 'cancelled'
    })
    .eq('id', bookingId)

  return transformApprovalRow(data)
}

/**
 * Get approval statistics for a user
 */
export async function getApprovalStats(userId: string): Promise<{
  pendingCount: number
  approvedCount: number
  rejectedCount: number
}> {
  const supabase = await createServerSupabaseClient()

  // Get pending approvals where user is the customer
  const { count: pendingCount } = await supabase
    .from('booking_approvals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .in('booking_id',
      supabase.from('bookings').select('id').eq('customer_id', userId)
    )

  // Get approved/rejected approvals requested by user
  const { data: requestedStats } = await supabase
    .from('booking_approvals')
    .select('status')
    .eq('requested_by', userId)

  const approvedCount = requestedStats?.filter(s => s.status === 'approved').length || 0
  const rejectedCount = requestedStats?.filter(s => s.status === 'rejected').length || 0

  return {
    pendingCount: pendingCount || 0,
    approvedCount,
    rejectedCount,
  }
}

// =====================================================
// Transform Functions
// =====================================================

function transformApprovalRow(row: any): BookingApproval {
  return {
    id: row.id,
    bookingId: row.booking_id,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by_name,
    respondedBy: row.responded_by,
    respondedByName: row.responded_by_name,
    status: row.status,
    requestMessage: row.request_message,
    responseMessage: row.response_message,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at,
    expiresAt: row.expires_at,
    // Joined fields
    booking: row.bookings ? {
      id: row.bookings.id,
      customerId: row.bookings.customer_id,
      customerName: row.bookings.customer_name,
      warehouseId: row.bookings.warehouse_id,
      type: row.bookings.type,
      startDate: row.bookings.start_date,
      totalAmount: row.bookings.total_amount,
    } : undefined,
    warehouseName: row.bookings?.warehouses?.name,
  }
}
