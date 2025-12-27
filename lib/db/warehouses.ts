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
    .select('id, name, address, city, zip_code, total_sq_ft, total_pallet_storage, latitude, longitude, owner_company_id, warehouse_type, storage_types, temperature_types, photos, amenities, operating_hours, status, custom_status, at_capacity_sq_ft, at_capacity_pallet, min_pallet, max_pallet, min_sq_ft, max_sq_ft, rent_methods, security, video_url, access_info, product_acceptance_start_time, product_acceptance_end_time, working_days, created_at, updated_at')
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
    .select('id, name, address, city, zip_code, total_sq_ft, total_pallet_storage, latitude, longitude, owner_company_id, warehouse_type, storage_types, temperature_types, photos, amenities, operating_hours, status, custom_status, at_capacity_sq_ft, at_capacity_pallet, min_pallet, max_pallet, min_sq_ft, max_sq_ft, rent_methods, security, video_url, access_info, product_acceptance_start_time, product_acceptance_end_time, working_days, created_at, updated_at')
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
      warehouse_type: warehouse.warehouseType,
      storage_types: warehouse.storageTypes,
      temperature_types: warehouse.temperatureTypes,
      photos: warehouse.photos,
      amenities: warehouse.amenities,
      operating_hours: warehouse.operatingHours,
      owner_company_id: warehouse.ownerCompanyId,
      custom_status: warehouse.customStatus,
      at_capacity_sq_ft: warehouse.atCapacitySqFt || false,
      at_capacity_pallet: warehouse.atCapacityPallet || false,
      min_pallet: warehouse.minPallet,
      max_pallet: warehouse.maxPallet,
      min_sq_ft: warehouse.minSqFt,
      max_sq_ft: warehouse.maxSqFt,
      rent_methods: warehouse.rentMethods || [],
      security: warehouse.security || [],
      video_url: (warehouse as any).videoUrl,
      access_info: (warehouse as any).accessInfo,
      product_acceptance_start_time: (warehouse as any).productAcceptanceStartTime,
      product_acceptance_end_time: (warehouse as any).productAcceptanceEndTime,
      working_days: (warehouse as any).workingDays,
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
  if (updates.warehouseType !== undefined) updateData.warehouse_type = updates.warehouseType
  if (updates.storageTypes !== undefined) updateData.storage_types = updates.storageTypes
  if (updates.temperatureTypes !== undefined) updateData.temperature_types = updates.temperatureTypes
  if (updates.photos !== undefined) updateData.photos = updates.photos
  if (updates.amenities !== undefined) updateData.amenities = updates.amenities
  if (updates.operatingHours !== undefined)
    updateData.operating_hours = updates.operatingHours
  if (updates.customStatus !== undefined) updateData.custom_status = updates.customStatus
  if (updates.atCapacitySqFt !== undefined) updateData.at_capacity_sq_ft = updates.atCapacitySqFt
  if (updates.atCapacityPallet !== undefined) updateData.at_capacity_pallet = updates.atCapacityPallet
  if (updates.minPallet !== undefined) updateData.min_pallet = updates.minPallet
  if (updates.maxPallet !== undefined) updateData.max_pallet = updates.maxPallet
  if (updates.minSqFt !== undefined) updateData.min_sq_ft = updates.minSqFt
  if (updates.maxSqFt !== undefined) updateData.max_sq_ft = updates.maxSqFt
  if (updates.rentMethods !== undefined) updateData.rent_methods = updates.rentMethods
  if (updates.security !== undefined) updateData.security = updates.security
  if ((updates as any).videoUrl !== undefined) updateData.video_url = (updates as any).videoUrl
  if ((updates as any).accessInfo !== undefined) updateData.access_info = (updates as any).accessInfo
  if ((updates as any).productAcceptanceStartTime !== undefined) updateData.product_acceptance_start_time = (updates as any).productAcceptanceStartTime
  if ((updates as any).productAcceptanceEndTime !== undefined) updateData.product_acceptance_end_time = (updates as any).productAcceptanceEndTime
  if ((updates as any).workingDays !== undefined) updateData.working_days = (updates as any).workingDays

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
    warehouseType: Array.isArray(row.warehouse_type) ? row.warehouse_type : (row.warehouse_type ? [row.warehouse_type] : []),
    storageTypes: Array.isArray(row.storage_types) ? row.storage_types : (row.storage_types ? [row.storage_types] : []),
    temperatureTypes: Array.isArray(row.temperature_types) ? row.temperature_types : (row.temperature_types ? [row.temperature_types] : []),
    photos: Array.isArray(row.photos) ? row.photos : [],
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    operatingHours: row.operating_hours || {
      open: '08:00',
      close: '18:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    floors: [], // Floors should be loaded separately
    customStatus: row.custom_status || undefined,
    atCapacitySqFt: row.at_capacity_sq_ft || false,
    atCapacityPallet: row.at_capacity_pallet || false,
    minPallet: row.min_pallet || undefined,
    maxPallet: row.max_pallet || undefined,
    minSqFt: row.min_sq_ft || undefined,
    maxSqFt: row.max_sq_ft || undefined,
    rentMethods: Array.isArray(row.rent_methods) ? row.rent_methods : [],
    security: Array.isArray(row.security) ? row.security : [],
    videoUrl: row.video_url || undefined,
    accessInfo: row.access_info || undefined,
    productAcceptanceStartTime: row.product_acceptance_start_time || undefined,
    productAcceptanceEndTime: row.product_acceptance_end_time || undefined,
    workingDays: Array.isArray(row.working_days) ? row.working_days : [],
  }
  // Add ownerCompanyId as additional property (state column was removed in migration 073)
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

