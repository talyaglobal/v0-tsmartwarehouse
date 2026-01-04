/**
 * Availability Service
 * 
 * Calculates warehouse availability based on existing bookings
 * and availability calendar table.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { AvailabilityCheck, AvailabilityResult } from '@/types/marketplace'

/**
 * Check if a warehouse has available capacity for a booking
 */
export async function checkAvailability(
  params: AvailabilityCheck
): Promise<AvailabilityResult> {
  const supabase = createServerSupabaseClient()
  const { warehouse_id, type, quantity, start_date, end_date } = params

  try {
    // Get warehouse capacity
    const { data: warehouse, error: warehouseError } = await supabase
      .from('warehouses')
      .select('total_pallet_storage, available_pallet_storage, total_sq_ft, available_sq_ft')
      .eq('id', warehouse_id)
      .single()

    if (warehouseError || !warehouse) {
      throw warehouseError || new Error('Warehouse not found')
    }

    // Get overlapping bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('pallet_count, area_sq_ft, start_date, end_date')
      .eq('warehouse_id', warehouse_id)
      .in('booking_status', ['pending', 'confirmed', 'active'])
      .or(`start_date.lte.${end_date},end_date.gte.${start_date}`)

    if (bookingsError) {
      throw bookingsError
    }

    // Get availability calendar entries for date range
    const { data: availabilityEntries, error: availabilityError } = await supabase
      .from('warehouse_availability')
      .select('date, available_pallet_slots, available_area_sqft, is_blocked')
      .eq('warehouse_id', warehouse_id)
      .gte('date', start_date)
      .lte('date', end_date)
      .order('date', { ascending: true })

    if (availabilityError) {
      console.warn('[availability] Error fetching availability calendar:', availabilityError)
    }

    // Check if any dates are blocked
    const blockedDates = (availabilityEntries || [])
      .filter((entry) => entry.is_blocked)
      .map((entry) => entry.date)

    if (blockedDates.length > 0) {
      return {
        available: false,
        requested_quantity: quantity,
        available_quantity: 0,
        utilization_percent: 100,
        conflicting_dates: blockedDates,
      }
    }

    // Calculate used capacity from bookings
    let usedCapacity = 0
    if (type === 'pallet') {
      usedCapacity = (bookings || []).reduce((sum, b) => sum + (b.pallet_count || 0), 0)
    } else {
      usedCapacity = (bookings || []).reduce((sum, b) => sum + (b.area_sq_ft || 0), 0)
    }

    // Check availability calendar for specific dates
    let calendarAvailableCapacity = type === 'pallet' 
      ? warehouse.available_pallet_storage 
      : warehouse.available_sq_ft

    if (availabilityEntries && availabilityEntries.length > 0) {
      // Use minimum available capacity across the date range
      const availableCapacities = availabilityEntries.map((entry) =>
        type === 'pallet' ? (entry.available_pallet_slots || 0) : (entry.available_area_sqft || 0)
      )
      calendarAvailableCapacity = Math.min(...availableCapacities)
    }

    const totalCapacity = type === 'pallet' 
      ? warehouse.total_pallet_storage 
      : warehouse.total_sq_ft
    
    const availableCapacity = Math.min(
      calendarAvailableCapacity,
      totalCapacity - usedCapacity
    )
    const utilizationPercent = totalCapacity > 0
      ? Math.round((usedCapacity / totalCapacity) * 100)
      : 0

    return {
      available: availableCapacity >= quantity,
      requested_quantity: quantity,
      available_quantity: availableCapacity,
      utilization_percent: utilizationPercent,
    }
  } catch (error) {
    console.error('[availability] Error checking availability:', error)
    return {
      available: false,
      requested_quantity: quantity,
      available_quantity: 0,
      utilization_percent: 100,
    }
  }
}

/**
 * Get availability calendar for a warehouse
 */
export async function getAvailabilityCalendar(
  warehouseId: string,
  startDate: string,
  endDate: string
) {
  const supabase = createServerSupabaseClient()

  try {
    // Get warehouse capacity
    const { data: warehouse } = await supabase
      .from('warehouses')
      .select('total_pallet_storage, total_sq_ft')
      .eq('id', warehouseId)
      .single()

    if (!warehouse) {
      return []
    }

    // Get availability calendar entries
    const { data: availabilityEntries } = await supabase
      .from('warehouse_availability')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    // Get overlapping bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, type, pallet_count, area_sq_ft, start_date, end_date')
      .eq('warehouse_id', warehouseId)
      .in('booking_status', ['pending', 'confirmed', 'active'])
      .or(`start_date.lte.${endDate},end_date.gte.${startDate}`)

    // Generate date range
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    const current = new Date(start)

    while (current <= end) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }

    // Build availability array
    return dates.map((date) => {
      const entry = (availabilityEntries || []).find((e) => e.date === date)
      const dayBookings = (bookings || []).filter(
        (b) => b.start_date <= date && (b.end_date === null || b.end_date >= date)
      )

      let usedSqFt = 0
      let usedPallets = 0

      dayBookings.forEach((booking) => {
        if (booking.type === 'pallet') {
          usedPallets += booking.pallet_count || 0
        } else {
          usedSqFt += booking.area_sq_ft || 0
        }
      })

      const availableSqFt = entry?.available_area_sqft ?? warehouse.total_sq_ft - usedSqFt
      const availablePallets = entry?.available_pallet_slots ?? warehouse.total_pallet_storage - usedPallets

      return {
        warehouseId,
        date,
        availableSqFt: Math.max(0, availableSqFt),
        availablePallets: Math.max(0, availablePallets),
        isAvailable: !entry?.is_blocked && availableSqFt > 0 && availablePallets > 0,
        bookings: dayBookings.map((b) => ({
          bookingId: b.id,
          startDate: b.start_date,
          endDate: b.end_date || 'ongoing',
          type: b.type,
          quantity: b.type === 'pallet' ? (b.pallet_count || 0) : (b.area_sq_ft || 0),
        })),
      }
    })
  } catch (error) {
    console.error('[availability] Error getting availability calendar:', error)
    return []
  }
}
