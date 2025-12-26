/**
 * Business Logic: Inventory Tracking
 * 
 * Handles:
 * - Warehouse tracking number generation
 * - Storage duration calculations
 * - Location updates with region support
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateInventoryItem } from '@/lib/db/inventory'

/**
 * Generate warehouse tracking number
 * Format: WH-YYYY-NNNNNN
 */
export async function generateWarehouseTrackingNumber(): Promise<string> {
  const supabase = createServerSupabaseClient()
  
  // Call the database function to generate tracking number
  const { data, error } = await supabase.rpc('generate_warehouse_tracking_number')

  if (error) {
    throw new Error(`Failed to generate warehouse tracking number: ${error.message}`)
  }

  return data as string
}

/**
 * Calculate storage duration for an inventory item
 */
export async function calculateStorageDuration(
  receivedDate: string | Date | null | undefined
): Promise<{ days: number; months: number }> {
  if (!receivedDate) {
    return { days: 0, months: 0 }
  }

  const received = typeof receivedDate === 'string' ? new Date(receivedDate) : receivedDate
  const today = new Date()
  const diffTime = today.getTime() - received.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  const diffMonths = parseFloat((diffDays / 30.0).toFixed(2))

  return {
    days: Math.max(0, diffDays),
    months: Math.max(0, diffMonths),
  }
}

/**
 * Update inventory location with region support
 */
export interface UpdateInventoryLocationInput {
  inventoryItemId: string
  floorId?: string
  regionId?: string
  hallId?: string
  zoneId?: string
  locationCode?: string
  rowNumber?: number
  levelNumber?: number
}

export async function updateInventoryLocation(
  input: UpdateInventoryLocationInput
): Promise<void> {
  const updates: any = {}

  if (input.floorId !== undefined) updates.floor_id = input.floorId
  if (input.regionId !== undefined) updates.region_id = input.regionId
  if (input.hallId !== undefined) updates.hall_id = input.hallId
  if (input.zoneId !== undefined) updates.zone_id = input.zoneId
  if (input.locationCode !== undefined) updates.location_code = input.locationCode
  if (input.rowNumber !== undefined) updates.row_number = input.rowNumber
  if (input.levelNumber !== undefined) updates.level_number = input.levelNumber

  await updateInventoryItem(input.inventoryItemId, updates)
}

