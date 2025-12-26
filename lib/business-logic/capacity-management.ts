/**
 * Business Logic: Capacity Management
 * 
 * Handles:
 * - Warehouse capacity calculations
 * - Zone-level capacity calculations
 * - Customer-specific capacity usage
 * - Capacity snapshot creation
 */

import { getCapacityUtilization, getCustomerCapacityUsage } from '@/lib/db/warehouses'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { CapacityUtilization } from '@/types'

/**
 * Calculate overall warehouse utilization
 */
export async function calculateWarehouseCapacity(
  warehouseId: string
): Promise<CapacityUtilization[]> {
  return getCapacityUtilization(warehouseId)
}

/**
 * Calculate zone-level capacity
 */
export async function calculateZoneCapacity(
  zoneId: string,
  warehouseId?: string
): Promise<CapacityUtilization[]> {
  return getCapacityUtilization(warehouseId, zoneId)
}

/**
 * Calculate customer-specific capacity usage
 */
export async function calculateCustomerCapacity(
  customerId: string,
  warehouseId?: string
): Promise<CapacityUtilization[]> {
  return getCustomerCapacityUsage(customerId, warehouseId)
}

/**
 * Create capacity snapshot record
 */
export async function createCapacitySnapshot(
  warehouseId?: string,
  zoneId?: string,
  customerId?: string,
  snapshotDate?: Date
): Promise<string> {
  const supabase = createServerSupabaseClient()

  const date = snapshotDate || new Date()
  const dateStr = date.toISOString().split('T')[0]

  const params: any = {
    p_snapshot_date: dateStr,
  }

  if (warehouseId) params.p_warehouse_id = warehouseId
  if (zoneId) params.p_zone_id = zoneId
  if (customerId) params.p_customer_id = customerId

  const { data, error } = await supabase.rpc('create_capacity_snapshot', params)

  if (error) {
    throw new Error(`Failed to create capacity snapshot: ${error.message}`)
  }

  return data as string
}

/**
 * Calculate warehouse availability for a specific date range
 * This checks existing bookings that overlap with the requested date range
 */
export interface WarehouseAvailability {
  total: number // Total capacity (slots or sq ft)
  occupied: number // Occupied capacity from overlapping bookings
  available: number // Available capacity
  availablePercent: number // Available as percentage
}

export async function calculateWarehouseAvailability(
  warehouseId: string,
  fromDate: string, // ISO date string (YYYY-MM-DD)
  toDate: string, // ISO date string (YYYY-MM-DD)
  bookingType: 'pallet' | 'area-rental'
): Promise<WarehouseAvailability> {
  const supabase = createServerSupabaseClient()

  // Get total capacity from warehouse
  let totalCapacity = 0

  if (bookingType === 'pallet') {
    // Get total pallet slots from zones
    // First, get all floors for this warehouse
    const { data: floors, error: floorsError } = await supabase
      .from('warehouse_floors')
      .select('id')
      .eq('warehouse_id', warehouseId)
      .eq('status', true) // Soft delete filter

    if (floorsError) {
      throw new Error(`Failed to fetch floors: ${floorsError.message}`)
    }

    if (!floors || floors.length === 0) {
      return {
        total: 0,
        occupied: 0,
        available: 0,
        availablePercent: 0,
      }
    }

    const floorIds = floors.map(f => f.id)

    // Get all halls for these floors
    const { data: halls, error: hallsError } = await supabase
      .from('warehouse_halls')
      .select('id')
      .in('floor_id', floorIds)
      .eq('status', true) // Soft delete filter

    if (hallsError) {
      throw new Error(`Failed to fetch halls: ${hallsError.message}`)
    }

    if (!halls || halls.length === 0) {
      return {
        total: 0,
        occupied: 0,
        available: 0,
        availablePercent: 0,
      }
    }

    const hallIds = halls.map(h => h.id)

    // Get all pallet zones for these halls
    const { data: zones, error: zonesError } = await supabase
      .from('warehouse_zones')
      .select('total_slots')
      .in('hall_id', hallIds)
      .eq('type', 'pallet')
      .eq('status', true) // Soft delete filter

    if (zonesError) {
      throw new Error(`Failed to fetch zones: ${zonesError.message}`)
    }

    totalCapacity = zones?.reduce((sum, zone) => sum + (zone.total_slots || 0), 0) || 0

    // Get overlapping bookings for pallet storage
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('pallet_count')
      .eq('warehouse_id', warehouseId)
      .eq('type', 'pallet')
      .in('booking_status', ['confirmed', 'active'])
      .eq('status', true) // Soft delete filter
      .or(`and(start_date.lte.${toDate},end_date.gte.${fromDate}),and(start_date.gte.${fromDate},end_date.lte.${toDate}),and(start_date.lte.${fromDate},end_date.gte.${toDate})`)

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`)
    }

    const occupiedCapacity = bookings?.reduce((sum, booking) => sum + (booking.pallet_count || 0), 0) || 0
    const availableCapacity = Math.max(0, totalCapacity - occupiedCapacity)

    return {
      total: totalCapacity,
      occupied: occupiedCapacity,
      available: availableCapacity,
      availablePercent: totalCapacity > 0 ? (availableCapacity / totalCapacity) * 100 : 0,
    }
  } else {
    // Get total sq ft from floor 3 halls
    const { data: floors, error: floorsError } = await supabase
      .from('warehouse_floors')
      .select('id')
      .eq('warehouse_id', warehouseId)
      .eq('floor_number', 3)
      .eq('status', true) // Soft delete filter
      .single()

    if (floorsError) {
      throw new Error(`Failed to fetch floor 3: ${floorsError.message}`)
    }

    const { data: halls, error: hallsError } = await supabase
      .from('warehouse_halls')
      .select('sq_ft')
      .eq('floor_id', floors.id)
      .eq('status', true) // Soft delete filter

    if (hallsError) {
      throw new Error(`Failed to fetch halls: ${hallsError.message}`)
    }

    totalCapacity = halls?.reduce((sum, hall) => sum + (hall.sq_ft || 0), 0) || 0

    // Get overlapping bookings for area rental
    // Overlap check: bookings where (start_date <= toDate AND end_date >= fromDate)
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('area_sq_ft, start_date, end_date')
      .eq('warehouse_id', warehouseId)
      .eq('type', 'area-rental')
      .in('booking_status', ['confirmed', 'active'])
      .eq('status', true) // Soft delete filter
      .lte('start_date', toDate) // Booking starts before or on the requested end date
      .gte('end_date', fromDate) // Booking ends after or on the requested start date

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`)
    }

    const occupiedCapacity = bookings?.reduce((sum, booking) => sum + (booking.area_sq_ft || 0), 0) || 0
    const availableCapacity = Math.max(0, totalCapacity - occupiedCapacity)

    return {
      total: totalCapacity,
      occupied: occupiedCapacity,
      available: availableCapacity,
      availablePercent: totalCapacity > 0 ? (availableCapacity / totalCapacity) * 100 : 0,
    }
  }
}

