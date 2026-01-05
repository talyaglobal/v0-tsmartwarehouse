import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Booking, BookingStatus, BookingType } from '@/types'
import { getCache, setCache, invalidateCache, generateCacheKey, CACHE_PREFIXES, CACHE_TTL } from '@/lib/cache/redis'

/**
 * Database operations for Bookings with caching and query optimization
 */

interface GetBookingsOptions {
  customerId?: string
  companyId?: string
  warehouseCompanyId?: string
  status?: BookingStatus
  type?: BookingType
  warehouseId?: string
  warehouseIds?: string[] // Support multiple warehouse IDs
  limit?: number
  offset?: number
  useCache?: boolean
}

export async function getBookings(filters?: GetBookingsOptions) {
  const {
    customerId,
    companyId,
    warehouseCompanyId,
    status,
    type,
    warehouseId,
    warehouseIds: _warehouseIds,
    limit,
    offset = 0,
    useCache = true,
  } = filters || {}

  // Generate cache key
  const cacheKey = generateCacheKey(
    CACHE_PREFIXES.BOOKINGS,
    customerId || companyId || warehouseCompanyId || 'all',
    status || 'all',
    type || 'all',
    warehouseId || 'all',
    limit || 'all',
    offset
  )

  // Try cache first
  if (useCache) {
    const cached = await getCache<Booking[]>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const supabase = createServerSupabaseClient()
  
  // Optimize: Only select needed fields instead of '*'
  // Note: booking_status is business status, status is for soft delete
  let query = supabase
    .from('bookings')
    .select('id, customer_id, customer_name, customer_email, warehouse_id, type, booking_status, status, pallet_count, area_sq_ft, floor_number, hall_id, start_date, end_date, total_amount, notes, scheduled_dropoff_datetime, time_slot_set_by, time_slot_set_at, time_slot_confirmed_at, proposed_start_date, proposed_start_time, date_change_requested_at, date_change_requested_by, created_at, updated_at')
    .eq('status', true) // Soft delete filter - only non-deleted bookings

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }
  
  if (companyId) {
    // Filter by company: get all customer_ids from profiles that belong to this company
    // Then filter bookings by those customer_ids
    const { data: companyProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
    
    if (companyProfiles && companyProfiles.length > 0) {
      const companyUserIds = companyProfiles.map(p => p.id)
      query = query.in('customer_id', companyUserIds)
    } else {
      // No users in company, return empty result
      query = query.eq('customer_id', '00000000-0000-0000-0000-000000000000') // Non-existent ID
    }
  }

  if (warehouseCompanyId) {
    // Filter by warehouse company: get all warehouse_ids that belong to this company
    // Then filter bookings by those warehouse_ids
    // Note: We don't filter by warehouse status here - company admins should see
    // all bookings to their warehouses (active or inactive)
    const { data: companyWarehouses } = await supabase
      .from('warehouses')
      .select('id')
      .eq('owner_company_id', warehouseCompanyId)

    if (companyWarehouses && companyWarehouses.length > 0) {
      const warehouseIds = companyWarehouses.map(w => w.id)
      query = query.in('warehouse_id', warehouseIds)
    } else {
      // No warehouses in company, return empty result
      query = query.eq('warehouse_id', '00000000-0000-0000-0000-000000000000') // Non-existent ID
    }
  }
  if (status) {
    query = query.eq('booking_status', status)
  }
  if (type) {
    query = query.eq('type', type)
  }
  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }
  if (filters?.warehouseIds && filters.warehouseIds.length > 0) {
    query = query.in('warehouse_id', filters.warehouseIds)
  }

  // Add pagination if limit is provided
  if (limit) {
    query = query.range(offset, offset + limit - 1)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch bookings: ${error.message}`)
  }

  // Transform database rows to Booking type
  const bookings = (data || []).map(transformBookingRow)

  // Cache the results
  if (useCache) {
    await setCache(cacheKey, bookings, CACHE_TTL.MEDIUM)
  }

  return bookings
}

export async function getBookingById(id: string, useCache: boolean = true): Promise<Booking | null> {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.BOOKING, id)

  // Try cache first
  if (useCache) {
    const cached = await getCache<Booking>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id,
      customer_id,
      customer_name,
      customer_email,
      warehouse_id,
      type,
      booking_status,
      status,
      pallet_count,
      area_sq_ft,
      floor_number,
      hall_id,
      start_date,
      end_date,
      total_amount,
      notes,
      scheduled_dropoff_datetime,
      time_slot_set_by,
      time_slot_set_at,
      time_slot_confirmed_at,
      proposed_start_date,
      proposed_start_time,
      date_change_requested_at,
      date_change_requested_by,
      cancel_requested_at,
      cancel_requested_by,
      cancel_reason,
      cancel_processed_at,
      cancel_processed_by,
      metadata,
      created_at,
      updated_at,
      warehouses(name, address, city)
    `)
    .eq('id', id)
    .eq('status', true) // Soft delete filter
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    throw new Error(`Failed to fetch booking: ${error.message}`)
  }

  const booking = data ? transformBookingRow(data) : null

  // Cache the result
  if (booking && useCache) {
    await setCache(cacheKey, booking, CACHE_TTL.MEDIUM)
  }

  return booking
}

export async function createBooking(booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<Booking> {
  const supabase = createServerSupabaseClient()
  
  // Get warehouse city for booking ID generation
  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('city')
    .eq('id', booking.warehouseId)
    .single()

  if (!warehouse) {
    throw new Error('Warehouse not found')
  }

  // Generate unique booking ID
  const { generateUniqueBookingId } = await import('@/lib/utils/booking-id')
  const bookingId = await generateUniqueBookingId({
    city: warehouse.city || 'UNK',
    startDate: booking.startDate,
    endDate: booking.endDate || booking.startDate,
    type: booking.type,
  })
  
  const bookingRow = {
    id: bookingId,
    customer_id: booking.customerId,
    customer_name: booking.customerName,
    customer_email: booking.customerEmail,
    warehouse_id: booking.warehouseId,
    type: booking.type,
    booking_status: booking.status,
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

  const newBooking = transformBookingRow(data)

  // Invalidate cache
  await invalidateCache(CACHE_PREFIXES.BOOKINGS)

  return newBooking
}

export async function updateBooking(
  id: string,
  updates: Partial<Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Booking> {
  const supabase = createServerSupabaseClient()
  
  const updateRow: Record<string, any> = {}
  if (updates.type !== undefined) updateRow.type = updates.type
  if (updates.status !== undefined) updateRow.booking_status = updates.status
  if (updates.palletCount !== undefined) updateRow.pallet_count = updates.palletCount
  if (updates.areaSqFt !== undefined) updateRow.area_sq_ft = updates.areaSqFt
  if (updates.floorNumber !== undefined) updateRow.floor_number = updates.floorNumber
  if (updates.hallId !== undefined) updateRow.hall_id = updates.hallId ?? null
  if (updates.startDate !== undefined) updateRow.start_date = updates.startDate
  if (updates.endDate !== undefined) updateRow.end_date = updates.endDate ?? null
  if (updates.totalAmount !== undefined) updateRow.total_amount = updates.totalAmount
  if (updates.notes !== undefined) updateRow.notes = updates.notes ?? null
  if (updates.scheduledDropoffDatetime !== undefined) updateRow.scheduled_dropoff_datetime = updates.scheduledDropoffDatetime ?? null
  if (updates.timeSlotSetBy !== undefined) updateRow.time_slot_set_by = updates.timeSlotSetBy ?? null
  if (updates.timeSlotSetAt !== undefined) updateRow.time_slot_set_at = updates.timeSlotSetAt ?? null
  if (updates.timeSlotConfirmedAt !== undefined) updateRow.time_slot_confirmed_at = updates.timeSlotConfirmedAt ?? null
  if (updates.proposedStartDate !== undefined) updateRow.proposed_start_date = updates.proposedStartDate ?? null
  if (updates.proposedStartTime !== undefined) updateRow.proposed_start_time = updates.proposedStartTime ?? null
  if (updates.dateChangeRequestedAt !== undefined) updateRow.date_change_requested_at = updates.dateChangeRequestedAt ?? null
  if (updates.dateChangeRequestedBy !== undefined) updateRow.date_change_requested_by = updates.dateChangeRequestedBy ?? null
  if ((updates as any).cancelRequestedAt !== undefined) updateRow.cancel_requested_at = (updates as any).cancelRequestedAt ?? null
  if ((updates as any).cancelRequestedBy !== undefined) updateRow.cancel_requested_by = (updates as any).cancelRequestedBy ?? null
  if ((updates as any).cancelReason !== undefined) updateRow.cancel_reason = (updates as any).cancelReason ?? null
  if ((updates as any).cancelProcessedAt !== undefined) updateRow.cancel_processed_at = (updates as any).cancelProcessedAt ?? null
  if ((updates as any).cancelProcessedBy !== undefined) updateRow.cancel_processed_by = (updates as any).cancelProcessedBy ?? null

  const { data, error } = await supabase
    .from('bookings')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update booking: ${error.message}`)
  }

  const updatedBooking = transformBookingRow(data)

  // Invalidate cache
  await invalidateCache(CACHE_PREFIXES.BOOKINGS, id)

  return updatedBooking
}

export async function deleteBooking(id: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  // Soft delete: set status = false
  const { error } = await supabase
    .from('bookings')
    .update({ status: false })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete booking: ${error.message}`)
  }

  // Invalidate cache
  await invalidateCache(CACHE_PREFIXES.BOOKINGS, id)
}

/**
 * Transform database row to Booking type
 */
function transformBookingRow(row: any): Booking & { warehouse_name?: string; warehouse_address?: string; warehouse_city?: string } {
  const booking: any = {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    warehouseId: row.warehouse_id,
    type: row.type,
    status: row.booking_status,
    palletCount: row.pallet_count ?? undefined,
    areaSqFt: row.area_sq_ft ?? undefined,
    floorNumber: row.floor_number ?? undefined,
    hallId: row.hall_id ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    totalAmount: parseFloat(row.total_amount),
    notes: row.notes ?? undefined,
    scheduledDropoffDatetime: row.scheduled_dropoff_datetime ?? undefined,
    timeSlotSetBy: row.time_slot_set_by ?? undefined,
    timeSlotSetAt: row.time_slot_set_at ?? undefined,
    timeSlotConfirmedAt: row.time_slot_confirmed_at ?? undefined,
    proposedStartDate: (row as any).proposed_start_date ?? undefined,
    proposedStartTime: (row as any).proposed_start_time ?? undefined,
    dateChangeRequestedAt: (row as any).date_change_requested_at ?? undefined,
    dateChangeRequestedBy: (row as any).date_change_requested_by ?? undefined,
    cancelRequestedAt: (row as any).cancel_requested_at ?? undefined,
    cancelRequestedBy: (row as any).cancel_requested_by ?? undefined,
    cancelReason: (row as any).cancel_reason ?? undefined,
    cancelProcessedAt: (row as any).cancel_processed_at ?? undefined,
    cancelProcessedBy: (row as any).cancel_processed_by ?? undefined,
    metadata: (row as any).metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

  // Add warehouse details if available (from JOIN)
  if (row.warehouses) {
    booking.warehouse_name = row.warehouses.name
    booking.warehouse_address = row.warehouses.address
    booking.warehouse_city = row.warehouses.city
  }

  return booking
}

