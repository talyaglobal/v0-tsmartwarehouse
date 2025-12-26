/**
 * Database operations for Warehouses
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { invalidateCache, CACHE_PREFIXES } from '@/lib/cache/redis'
import type { Warehouse, WarehouseRegion, CapacityUtilization } from '@/types'

interface GetWarehousesOptions {
  ownerCompanyId?: string
  city?: string
  limit?: number
  offset?: number
}

/**
 * Get warehouses with optional filters
 */
export async function getWarehouses(
  filters?: GetWarehousesOptions
): Promise<Warehouse[]> {
  const supabase = await createServerSupabaseClient()
  // Note: Include latitude and longitude for Google Maps
  let query = supabase
    .from('warehouses')
    .select('id, name, address, city, zip_code, total_sq_ft, total_pallet_storage, latitude, longitude, owner_company_id, amenities, operating_hours, status, created_at, updated_at')
    .eq('status', true) // Soft delete filter

  if (filters?.ownerCompanyId) {
    query = query.eq('owner_company_id', filters.ownerCompanyId)
  }
  if (filters?.city) {
    query = query.eq('city', filters.city)
  }

  if (filters?.limit) {
    query = query.range(
      filters.offset || 0,
      (filters.offset || 0) + filters.limit - 1
    )
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch warehouses: ${error.message}`)
  }

  return (data || []).map(transformWarehouseRow)
}

/**
 * Get warehouse by ID
 */
export async function getWarehouseById(id: string): Promise<Warehouse | null> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('warehouses')
    .select('id, name, address, city, zip_code, total_sq_ft, total_pallet_storage, latitude, longitude, owner_company_id, amenities, operating_hours, status, created_at, updated_at')
    .eq('id', id)
    .eq('status', true) // Soft delete filter
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch warehouse: ${error.message}`)
  }

  return transformWarehouseRow(data)
}

/**
 * Create a new warehouse
 */
export async function createWarehouse(
  warehouse: Omit<Warehouse, 'id' | 'floors' | 'createdAt' | 'updatedAt'> & {
    ownerCompanyId: string
  }
): Promise<Warehouse> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('warehouses')
    .insert({
      name: warehouse.name,
      address: warehouse.address,
      city: warehouse.city,
      zip_code: warehouse.zipCode,
      total_sq_ft: warehouse.totalSqFt,
      total_pallet_storage: warehouse.totalPalletStorage,
      latitude: warehouse.latitude,
      longitude: warehouse.longitude,
      amenities: warehouse.amenities,
      operating_hours: warehouse.operatingHours,
      owner_company_id: warehouse.ownerCompanyId,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create warehouse: ${error.message}`)
  }

  // Return warehouse without floors (floors should be created separately)
  return transformWarehouseRow(data)
}

/**
 * Update warehouse
 */
export async function updateWarehouse(
  id: string,
  updates: Partial<
    Omit<Warehouse, 'id' | 'floors' | 'createdAt' | 'updatedAt'>
  >
): Promise<Warehouse> {
  const supabase = await createServerSupabaseClient()

  const updateData: any = {}
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.address !== undefined) updateData.address = updates.address
  if (updates.city !== undefined) updateData.city = updates.city
  if (updates.zipCode !== undefined) updateData.zip_code = updates.zipCode
  if (updates.totalSqFt !== undefined) updateData.total_sq_ft = updates.totalSqFt
  if (updates.totalPalletStorage !== undefined) updateData.total_pallet_storage = updates.totalPalletStorage
  if (updates.latitude !== undefined) updateData.latitude = updates.latitude
  if (updates.longitude !== undefined) updateData.longitude = updates.longitude
  if (updates.amenities !== undefined) updateData.amenities = updates.amenities
  if (updates.operatingHours !== undefined)
    updateData.operating_hours = updates.operatingHours

  const { data, error } = await supabase
    .from('warehouses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update warehouse: ${error.message}`)
  }

  // Invalidate cache
  await invalidateCache(CACHE_PREFIXES.WAREHOUSES)

  return transformWarehouseRow(data)
}

/**
 * Delete warehouse (soft delete)
 */
export async function deleteWarehouse(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient()

  // Soft delete: set status = false
  const { error } = await supabase
    .from('warehouses')
    .update({ status: false })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete warehouse: ${error.message}`)
  }

  // Invalidate cache
  await invalidateCache(CACHE_PREFIXES.WAREHOUSES)
}

/**
 * Transform database row to Warehouse type
 */
function transformWarehouseRow(row: any): Warehouse & { ownerCompanyId?: string | null } {
  const warehouse: Warehouse = {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    zipCode: row.zip_code,
    totalSqFt: row.total_sq_ft,
    totalPalletStorage: row.total_pallet_storage || undefined,
    latitude: row.latitude ? parseFloat(row.latitude) : undefined,
    longitude: row.longitude ? parseFloat(row.longitude) : undefined,
    amenities: row.amenities || [],
    operatingHours: row.operating_hours || {
      open: '08:00',
      close: '18:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    floors: [], // Floors should be loaded separately
  }
  // Add ownerCompanyId as an additional property
  return { ...warehouse, ownerCompanyId: row.owner_company_id || null }
}

/**
 * Get warehouse regions for a floor
 */
export async function getWarehouseRegions(floorId: string): Promise<WarehouseRegion[]> {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('warehouse_regions')
    .select('*')
    .eq('floor_id', floorId)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch warehouse regions: ${error.message}`)
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    floorId: row.floor_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

/**
 * Get capacity utilization
 */
export async function getCapacityUtilization(
  warehouseId?: string,
  zoneId?: string,
  customerId?: string
): Promise<CapacityUtilization[]> {
  const supabase = await createServerSupabaseClient()
  
  // Build parameters for the function call
  const params: any = {}
  if (warehouseId) params.p_warehouse_id = warehouseId
  if (zoneId) params.p_zone_id = zoneId
  if (customerId) params.p_customer_id = customerId

  // Call the database function
  const { data, error } = await supabase.rpc('calculate_capacity_utilization', params)

  if (error) {
    throw new Error(`Failed to calculate capacity utilization: ${error.message}`)
  }

  return (data || []).map((row: any) => ({
    warehouseId: row.warehouse_id,
    zoneId: row.zone_id,
    customerId: row.customer_id,
    totalCapacity: row.total_capacity,
    usedCapacity: row.used_capacity,
    percentageUsed: parseFloat(row.percentage_used),
  }))
}

/**
 * Get customer-specific capacity usage
 */
export async function getCustomerCapacityUsage(
  customerId: string,
  warehouseId?: string
): Promise<CapacityUtilization[]> {
  return getCapacityUtilization(warehouseId, undefined, customerId)
}

/**
 * Get warehouse floor by ID
 */
export async function getWarehouseFloorById(floorId: string): Promise<{
  id: string
  warehouseId: string
  floorNumber: number
  name: string
  totalSqFt: number
} | null> {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('warehouse_floors')
    .select('*')
    .eq('id', floorId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch warehouse floor: ${error.message}`)
  }

  return {
    id: data.id,
    warehouseId: data.warehouse_id,
    floorNumber: data.floor_number,
    name: data.name,
    totalSqFt: data.total_sq_ft,
  }
}

/**
 * Get warehouse hall by ID
 */
export async function getWarehouseHallById(hallId: string): Promise<{
  id: string
  floorId: string
  regionId?: string | null
  hallName: string
  sqFt: number
  availableSqFt: number
  occupiedSqFt: number
} | null> {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('warehouse_halls')
    .select('*')
    .eq('id', hallId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch warehouse hall: ${error.message}`)
  }

  return {
    id: data.id,
    floorId: data.floor_id,
    regionId: data.region_id,
    hallName: data.hall_name,
    sqFt: data.sq_ft,
    availableSqFt: data.available_sq_ft,
    occupiedSqFt: data.occupied_sq_ft,
  }
}

/**
 * Get warehouse zone by ID
 */
export async function getWarehouseZoneById(zoneId: string): Promise<{
  id: string
  hallId: string
  name: string
  type: string
  totalSlots?: number | null
  availableSlots?: number | null
  totalSqFt?: number | null
  availableSqFt?: number | null
} | null> {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('warehouse_zones')
    .select('*')
    .eq('id', zoneId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch warehouse zone: ${error.message}`)
  }

  return {
    id: data.id,
    hallId: data.hall_id,
    name: data.name,
    type: data.type,
    totalSlots: data.total_slots,
    availableSlots: data.available_slots,
    totalSqFt: data.total_sq_ft,
    availableSqFt: data.available_sq_ft,
  }
}

/**
 * Get warehouse region by ID
 */
export async function getWarehouseRegionById(regionId: string): Promise<WarehouseRegion | null> {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('warehouse_regions')
    .select('*')
    .eq('id', regionId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch warehouse region: ${error.message}`)
  }

  return {
    id: data.id,
    floorId: data.floor_id,
    name: data.name,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

