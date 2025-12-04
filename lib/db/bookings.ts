import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Booking, BookingStatus, BookingType } from '@/types'

/**
 * Database operations for Bookings
 */

export async function getBookings(filters?: {
  customerId?: string
  status?: BookingStatus
  type?: BookingType
  warehouseId?: string
}) {
  const supabase = createServerSupabaseClient()
  let query = supabase.from('bookings').select('*')

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.type) {
    query = query.eq('type', filters.type)
  }
  if (filters?.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch bookings: ${error.message}`)
  }

  // Transform database rows to Booking type
  return (data || []).map(transformBookingRow)
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    throw new Error(`Failed to fetch booking: ${error.message}`)
  }

  return data ? transformBookingRow(data) : null
}

export async function createBooking(booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<Booking> {
  const supabase = createServerSupabaseClient()
  
  const bookingRow = {
    customer_id: booking.customerId,
    customer_name: booking.customerName,
    customer_email: booking.customerEmail,
    warehouse_id: booking.warehouseId,
    type: booking.type,
    status: booking.status,
    pallet_count: booking.palletCount ?? null,
    area_sq_ft: booking.areaSqFt ?? null,
    floor_number: booking.floorNumber ?? null,
    hall_id: booking.hallId ?? null,
    start_date: booking.startDate,
    end_date: booking.endDate ?? null,
    total_amount: booking.totalAmount,
    notes: booking.notes ?? null,
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert(bookingRow)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create booking: ${error.message}`)
  }

  return transformBookingRow(data)
}

export async function updateBooking(
  id: string,
  updates: Partial<Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Booking> {
  const supabase = createServerSupabaseClient()
  
  const updateRow: Record<string, any> = {}
  if (updates.status !== undefined) updateRow.status = updates.status
  if (updates.palletCount !== undefined) updateRow.pallet_count = updates.palletCount
  if (updates.areaSqFt !== undefined) updateRow.area_sq_ft = updates.areaSqFt
  if (updates.floorNumber !== undefined) updateRow.floor_number = updates.floorNumber
  if (updates.hallId !== undefined) updateRow.hall_id = updates.hallId
  if (updates.startDate !== undefined) updateRow.start_date = updates.startDate
  if (updates.endDate !== undefined) updateRow.end_date = updates.endDate
  if (updates.totalAmount !== undefined) updateRow.total_amount = updates.totalAmount
  if (updates.notes !== undefined) updateRow.notes = updates.notes

  const { data, error } = await supabase
    .from('bookings')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update booking: ${error.message}`)
  }

  return transformBookingRow(data)
}

export async function deleteBooking(id: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('bookings').delete().eq('id', id)

  if (error) {
    throw new Error(`Failed to delete booking: ${error.message}`)
  }
}

/**
 * Transform database row to Booking type
 */
function transformBookingRow(row: any): Booking {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    warehouseId: row.warehouse_id,
    type: row.type,
    status: row.status,
    palletCount: row.pallet_count ?? undefined,
    areaSqFt: row.area_sq_ft ?? undefined,
    floorNumber: row.floor_number ?? undefined,
    hallId: row.hall_id ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    totalAmount: parseFloat(row.total_amount),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

