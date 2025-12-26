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

