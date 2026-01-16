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
    .select('id, name, address, city, zip_code, total_sq_ft, total_pallet_storage, available_sq_ft, available_pallet_storage, latitude, longitude, owner_company_id, warehouse_type, storage_type, temperature_types, photos, videos, description, amenities, operating_hours, status, custom_status, min_pallet, max_pallet, min_sq_ft, max_sq_ft, rent_methods, security, access_info, product_acceptance_time_slots, product_departure_time_slots, overtime_price, working_days, warehouse_in_fee, warehouse_out_fee, ports, free_storage_rules, created_at, updated_at')
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
    .select(`
      id,
      name,
      address,
      city,
      zip_code,
      total_sq_ft,
      total_pallet_storage,
      available_sq_ft,
      available_pallet_storage,
      latitude,
      longitude,
      owner_company_id,
      warehouse_type,
      storage_type,
      temperature_types,
      photos,
      videos,
      amenities,
      description,
      operating_hours,
      status,
      custom_status,
      min_pallet,
      max_pallet,
      min_sq_ft,
      max_sq_ft,
      rent_methods,
      security,
      access_info,
      product_acceptance_time_slots,
      product_departure_time_slots,
      working_days,
      warehouse_in_fee,
      warehouse_out_fee,
      overtime_price,
      free_storage_rules,
      ports,
      created_at,
      updated_at,
      warehouse_pricing(pricing_type, base_price, unit, min_quantity, max_quantity, volume_discounts),
      warehouse_pallet_pricing(
        id, pallet_type, pricing_period, goods_type, stackable, stackable_adjustment_type, stackable_adjustment_value, unstackable_adjustment_type, unstackable_adjustment_value, custom_length_cm, custom_width_cm, custom_height_cm,
        warehouse_pallet_height_pricing(id, height_min_cm, height_max_cm, price_per_unit),
        warehouse_pallet_weight_pricing(id, weight_min_kg, weight_max_kg, price_per_pallet),
        warehouse_custom_pallet_sizes(
          id,
          length_cm,
          width_cm,
          length_min_cm,
          length_max_cm,
          width_min_cm,
          width_max_cm,
          warehouse_custom_pallet_size_height_pricing(id, height_min_cm, height_max_cm, price_per_unit)
        )
      )
    `)
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

  // Debug: Log overtimePrice before insert
  if ((warehouse as any).overtimePrice) {
    console.log('[DB] OvertimePrice before insert:', JSON.stringify((warehouse as any).overtimePrice, null, 2))
  }

  const overtimePriceValue = (warehouse as any).overtimePrice && 
    ((warehouse as any).overtimePrice.afterRegularWorkTime?.in !== undefined || 
     (warehouse as any).overtimePrice.afterRegularWorkTime?.out !== undefined || 
     (warehouse as any).overtimePrice.holidays?.in !== undefined ||
     (warehouse as any).overtimePrice.holidays?.out !== undefined)
    ? (warehouse as any).overtimePrice 
    : null

  console.log('[DB] OvertimePrice value to insert:', JSON.stringify(overtimePriceValue, null, 2))

  const { data, error } = await supabase
    .from('warehouses')
    .insert({
      name: warehouse.name,
      address: warehouse.address,
      city: warehouse.city,
      zip_code: warehouse.zipCode,
      total_sq_ft: warehouse.totalSqFt,
      total_pallet_storage: warehouse.totalPalletStorage,
      available_sq_ft: warehouse.totalSqFt, // Initialize available with total
      available_pallet_storage: warehouse.totalPalletStorage, // Initialize available with total
      latitude: warehouse.latitude,
      longitude: warehouse.longitude,
      warehouse_type: Array.isArray(warehouse.warehouseType) ? warehouse.warehouseType : [warehouse.warehouseType || 'general-dry-ambient'], // Now array
      storage_type: Array.isArray(warehouse.storageType) ? warehouse.storageType : (warehouse.storageType ? [warehouse.storageType] : ['rack-space']), // Now array
      temperature_types: warehouse.temperatureTypes,
      photos: warehouse.photos,
      videos: (warehouse as any).videos || [], // New field - videos array
      description: (warehouse as any).description,
      amenities: warehouse.amenities,
      operating_hours: warehouse.operatingHours,
      owner_company_id: warehouse.ownerCompanyId,
      custom_status: warehouse.customStatus,
      min_pallet: warehouse.minPallet,
      max_pallet: warehouse.maxPallet,
      min_sq_ft: warehouse.minSqFt,
      max_sq_ft: warehouse.maxSqFt,
      rent_methods: warehouse.rentMethods || [],
      security: warehouse.security || [],
      access_info: (warehouse as any).accessInfo,
      product_acceptance_time_slots: (warehouse as any).productAcceptanceTimeSlots || [], // New field - time slots array
      product_departure_time_slots: (warehouse as any).productDepartureTimeSlots || [], // New field
      working_days: (warehouse as any).workingDays,
      warehouse_in_fee: (warehouse as any).warehouseInFee,
      warehouse_out_fee: (warehouse as any).warehouseOutFee,
      overtime_price: overtimePriceValue, // New field - JSONB format (Supabase automatically converts objects to JSONB)
      ports: (warehouse as any).ports || [],
      free_storage_rules: (warehouse as any).freeStorageRules || [],
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
  if (updates.warehouseType !== undefined) updateData.warehouse_type = Array.isArray(updates.warehouseType) ? updates.warehouseType : [updates.warehouseType || 'general-dry-ambient'] // Now array
  if (updates.storageType !== undefined) updateData.storage_type = Array.isArray(updates.storageType) ? updates.storageType : (updates.storageType ? [updates.storageType] : ['rack-space']) // Now array
  if (updates.temperatureTypes !== undefined) updateData.temperature_types = updates.temperatureTypes
  if (updates.photos !== undefined) updateData.photos = updates.photos
  if ((updates as any).videos !== undefined) updateData.videos = (updates as any).videos // New field - videos array
  if ((updates as any).description !== undefined) updateData.description = (updates as any).description
  if (updates.amenities !== undefined) updateData.amenities = updates.amenities
  if (updates.operatingHours !== undefined)
    updateData.operating_hours = updates.operatingHours
  if (updates.customStatus !== undefined) updateData.custom_status = updates.customStatus
  if (updates.minPallet !== undefined) updateData.min_pallet = updates.minPallet
  if (updates.maxPallet !== undefined) updateData.max_pallet = updates.maxPallet
  if (updates.minSqFt !== undefined) updateData.min_sq_ft = updates.minSqFt
  if (updates.maxSqFt !== undefined) updateData.max_sq_ft = updates.maxSqFt
  if (updates.rentMethods !== undefined) updateData.rent_methods = updates.rentMethods
  if (updates.security !== undefined) updateData.security = updates.security
  if ((updates as any).accessInfo !== undefined) updateData.access_info = (updates as any).accessInfo
  if ((updates as any).productAcceptanceTimeSlots !== undefined) updateData.product_acceptance_time_slots = (updates as any).productAcceptanceTimeSlots // New field - time slots array
  if ((updates as any).productDepartureTimeSlots !== undefined) updateData.product_departure_time_slots = (updates as any).productDepartureTimeSlots // New field
  if ((updates as any).workingDays !== undefined) updateData.working_days = (updates as any).workingDays
  if ((updates as any).warehouseInFee !== undefined) updateData.warehouse_in_fee = (updates as any).warehouseInFee
  if ((updates as any).warehouseOutFee !== undefined) updateData.warehouse_out_fee = (updates as any).warehouseOutFee
  if ((updates as any).overtimePrice !== undefined) {
    const overtimePrice = (updates as any).overtimePrice
    console.log('[UPDATE DB] OvertimePrice received:', JSON.stringify(overtimePrice, null, 2))
    
    // Only set if at least one field has a value
    if (overtimePrice && 
        (overtimePrice.afterRegularWorkTime?.in !== undefined || 
         overtimePrice.afterRegularWorkTime?.out !== undefined || 
         overtimePrice.holidays?.in !== undefined ||
         overtimePrice.holidays?.out !== undefined)) {
      updateData.overtime_price = overtimePrice // New field - JSONB format (Supabase automatically converts objects to JSONB)
      console.log('[UPDATE DB] OvertimePrice set in updateData:', JSON.stringify(updateData.overtime_price, null, 2))
    } else {
      updateData.overtime_price = null
      console.log('[UPDATE DB] OvertimePrice set to null (empty or no values)')
    }
  } else {
    console.log('[UPDATE DB] OvertimePrice is undefined in updates')
  }
  if ((updates as any).ports !== undefined) updateData.ports = (updates as any).ports
  if ((updates as any).freeStorageRules !== undefined) updateData.free_storage_rules = (updates as any).freeStorageRules

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
  // Transform pallet pricing data if present
  const palletPricing: any[] = []
  if (row.warehouse_pallet_pricing && Array.isArray(row.warehouse_pallet_pricing)) {
    row.warehouse_pallet_pricing.forEach((pp: any) => {
      const heightPricing = (pp.warehouse_pallet_height_pricing || []).map((hp: any) => ({
        id: hp.id,
        heightMinCm: hp.height_min_cm,
        heightMaxCm: hp.height_max_cm,
        pricePerUnit: parseFloat(hp.price_per_unit.toString()),
      }))
      const weightPricing = (pp.warehouse_pallet_weight_pricing || []).map((wp: any) => ({
        id: wp.id,
        weightMinKg: parseFloat(wp.weight_min_kg.toString()),
        weightMaxKg: parseFloat(wp.weight_max_kg.toString()),
        pricePerPallet: parseFloat(wp.price_per_pallet.toString()),
      }))
      const customSizes = (pp.warehouse_custom_pallet_sizes || []).map((size: any) => ({
        id: size.id,
        lengthMin: size.length_min_cm ?? size.length_cm,
        lengthMax: size.length_max_cm ?? size.length_cm,
        widthMin: size.width_min_cm ?? size.width_cm,
        widthMax: size.width_max_cm ?? size.width_cm,
        stackableAdjustmentType: size.stackable_adjustment_type || 'plus_per_unit',
        stackableAdjustmentValue: size.stackable_adjustment_value != null ? parseFloat(size.stackable_adjustment_value.toString()) : 0,
        unstackableAdjustmentType: size.unstackable_adjustment_type || 'plus_per_unit',
        unstackableAdjustmentValue: size.unstackable_adjustment_value != null ? parseFloat(size.unstackable_adjustment_value.toString()) : 0,
        heightRanges: (size.warehouse_custom_pallet_size_height_pricing || []).map((hr: any) => ({
          id: hr.id,
          heightMinCm: hr.height_min_cm,
          heightMaxCm: hr.height_max_cm,
          pricePerUnit: parseFloat(hr.price_per_unit.toString()),
        })),
      }))

      palletPricing.push({
        id: pp.id,
        palletType: pp.pallet_type,
        pricingPeriod: pp.pricing_period,
        goodsType: pp.goods_type || 'general',
        stackable: pp.stackable !== undefined ? pp.stackable : true, // Default to true if not specified
        stackableAdjustmentType: pp.stackable_adjustment_type || 'plus_per_unit',
        stackableAdjustmentValue: pp.stackable_adjustment_value != null ? parseFloat(pp.stackable_adjustment_value.toString()) : 0,
        unstackableAdjustmentType: pp.unstackable_adjustment_type || 'plus_per_unit',
        unstackableAdjustmentValue: pp.unstackable_adjustment_value != null ? parseFloat(pp.unstackable_adjustment_value.toString()) : 0,
        customDimensions: pp.custom_length_cm && pp.custom_width_cm && pp.custom_height_cm ? {
          length: pp.custom_length_cm,
          width: pp.custom_width_cm,
          height: pp.custom_height_cm,
          unit: 'cm',
        } : undefined,
        customSizes: customSizes.length > 0 ? customSizes : undefined,
        heightRanges: heightPricing.length > 0 ? heightPricing : undefined,
        weightRanges: weightPricing.length > 0 ? weightPricing : undefined,
      })
    })
  }

  // Transform pricing data if present
  const pricing: any = {}
  if (row.warehouse_pricing && Array.isArray(row.warehouse_pricing)) {
    row.warehouse_pricing.forEach((p: any) => {
      if (p.pricing_type === 'pallet') {
        pricing.pallet = {
          basePrice: p.base_price,
          unit: p.unit,
          minQuantity: p.min_quantity,
          maxQuantity: p.max_quantity,
          volumeDiscounts: p.volume_discounts || {}
        }
      } else if (p.pricing_type === 'pallet-monthly') {
        pricing.palletMonthly = {
          basePrice: p.base_price,
          unit: p.unit,
          minQuantity: p.min_quantity,
          maxQuantity: p.max_quantity,
          volumeDiscounts: p.volume_discounts || {}
        }
      } else if (p.pricing_type === 'area' || p.pricing_type === 'area-rental') {
        pricing.areaRental = {
          basePrice: p.base_price,
          unit: p.unit,
          minQuantity: p.min_quantity,
          maxQuantity: p.max_quantity,
          volumeDiscounts: p.volume_discounts || {}
        }
      }
    })
  }

  const warehouse: Warehouse = {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    zipCode: row.zip_code,
    totalSqFt: row.total_sq_ft,
    totalPalletStorage: row.total_pallet_storage || undefined,
    availableSqFt: row.available_sq_ft || undefined,
    availablePalletStorage: row.available_pallet_storage || undefined,
    latitude: row.latitude ? parseFloat(row.latitude) : undefined,
    longitude: row.longitude ? parseFloat(row.longitude) : undefined,
    warehouseType: row.warehouse_type ? (Array.isArray(row.warehouse_type) ? row.warehouse_type : [row.warehouse_type]) : [],
    storageType: row.storage_type ? (Array.isArray(row.storage_type) ? row.storage_type : [row.storage_type]) : [], // Now array
    temperatureTypes: Array.isArray(row.temperature_types) ? row.temperature_types : (row.temperature_types ? [row.temperature_types] : []),
    photos: Array.isArray(row.photos) ? row.photos : [],
    videos: Array.isArray(row.videos) ? row.videos : [], // New field - videos array
    description: row.description || undefined,
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    operatingHours: row.operating_hours || {
      open: row.product_acceptance_time_slots && Array.isArray(row.product_acceptance_time_slots) && row.product_acceptance_time_slots.length > 0
        ? row.product_acceptance_time_slots[0].start
        : '08:00',
      close: row.product_acceptance_time_slots && Array.isArray(row.product_acceptance_time_slots) && row.product_acceptance_time_slots.length > 0
        ? row.product_acceptance_time_slots[row.product_acceptance_time_slots.length - 1].end
        : '18:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    floors: [], // Floors should be loaded separately
    customStatus: row.custom_status || undefined,

    minPallet: row.min_pallet || undefined,
    maxPallet: row.max_pallet || undefined,
    minSqFt: row.min_sq_ft || undefined,
    maxSqFt: row.max_sq_ft || undefined,
    rentMethods: Array.isArray(row.rent_methods) ? row.rent_methods : [],
    security: Array.isArray(row.security) ? row.security : [],
    accessInfo: row.access_info || undefined,
    productAcceptanceTimeSlots: Array.isArray(row.product_acceptance_time_slots) ? row.product_acceptance_time_slots : [], // New field - time slots array
    productDepartureTimeSlots: Array.isArray(row.product_departure_time_slots) ? row.product_departure_time_slots : [], // New field
    workingDays: Array.isArray(row.working_days) ? row.working_days : [],
    overtimePrice: row.overtime_price != null && typeof row.overtime_price === 'object' 
      ? row.overtime_price as any
      : undefined, // New field - JSONB object with per-pallet in/out pricing
    freeStorageRules: Array.isArray(row.free_storage_rules) ? row.free_storage_rules : [],
    pricing: Object.keys(pricing).length > 0 ? pricing : undefined, // Add pricing to warehouse object
    // Additional fields
    warehouseInFee: row.warehouse_in_fee != null && row.warehouse_in_fee !== '' ? parseFloat(row.warehouse_in_fee.toString()) : undefined,
    warehouseOutFee: row.warehouse_out_fee != null && row.warehouse_out_fee !== '' ? parseFloat(row.warehouse_out_fee.toString()) : undefined,
    ports: row.ports || [],
    palletPricing: palletPricing.length > 0 ? palletPricing : undefined, // Add pallet pricing to warehouse object
  } as any
  // Add ownerCompanyId as additional property
  return {
    ...warehouse,
    ownerCompanyId: row.owner_company_id || null,
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

