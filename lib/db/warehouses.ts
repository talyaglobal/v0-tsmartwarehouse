/**
 * Database operations for Warehouses
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Warehouse, WarehouseRegion, CapacityUtilization } from '@/types'

interface GetWarehousesOptions {
  ownerCompanyId?: string
  city?: string
  state?: string
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
  let query = supabase.from('warehouses').select('*')

  if (filters?.ownerCompanyId) {
    query = query.eq('owner_company_id', filters.ownerCompanyId)
  }
  if (filters?.city) {
    query = query.eq('city', filters.city)
  }
  if (filters?.state) {
    query = query.eq('state', filters.state)
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
    .select('*')
    .eq('id', id)
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
      state: warehouse.state,
      zip_code: warehouse.zipCode,
      total_sq_ft: warehouse.totalSqFt,
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
  return {
    id: data.id,
    name: data.name,
    address: data.address,
    city: data.city,
    state: data.state,
    zipCode: data.zip_code,
    totalSqFt: data.total_sq_ft,
    amenities: data.amenities || [],
    operatingHours: data.operating_hours || {
      open: '08:00',
      close: '18:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    floors: [],
  }
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
  if (updates.state !== undefined) updateData.state = updates.state
  if (updates.zipCode !== undefined) updateData.zip_code = updates.zipCode
  if (updates.totalSqFt !== undefined) updateData.total_sq_ft = updates.totalSqFt
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

  return transformWarehouseRow(data)
}

/**
 * Transform database row to Warehouse type
 */
function transformWarehouseRow(row: any): Warehouse {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    totalSqFt: row.total_sq_ft,
    amenities: row.amenities || [],
    operatingHours: row.operating_hours || {
      open: '08:00',
      close: '18:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    floors: [], // Floors should be loaded separately
  }
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

