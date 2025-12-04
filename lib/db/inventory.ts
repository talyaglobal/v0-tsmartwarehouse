import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCache, setCache, invalidateCache, generateCacheKey, CACHE_PREFIXES, CACHE_TTL } from '@/lib/cache/redis'

/**
 * Database operations for Inventory Items with caching and query optimization
 */

export interface InventoryItem {
  id: string
  booking_id: string
  customer_id: string
  warehouse_id: string
  floor_id?: string | null
  hall_id?: string | null
  zone_id?: string | null
  pallet_id: string
  barcode?: string | null
  qr_code?: string | null
  description?: string | null
  item_type?: string | null
  weight_kg?: number | null
  dimensions?: any
  location_code?: string | null
  row_number?: number | null
  level_number?: number | null
  status: 'in-transit' | 'received' | 'stored' | 'moved' | 'shipped' | 'damaged' | 'lost'
  received_at?: string | null
  stored_at?: string | null
  last_moved_at?: string | null
  shipped_at?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface InventoryMovement {
  id: string
  inventory_item_id: string
  moved_by: string
  moved_by_name: string
  movement_type: 'received' | 'stored' | 'moved' | 'shipped' | 'returned' | 'damaged'
  from_location?: string | null
  to_location?: string | null
  from_location_code?: string | null
  to_location_code?: string | null
  from_hall_id?: string | null
  to_hall_id?: string | null
  from_zone_id?: string | null
  to_zone_id?: string | null
  reason?: string | null
  notes?: string | null
  created_at: string
}

interface GetInventoryOptions {
  bookingId?: string
  customerId?: string
  warehouseId?: string
  hallId?: string
  zoneId?: string
  status?: InventoryItem['status']
  search?: string // Search by pallet_id, barcode, or qr_code
  limit?: number
  offset?: number
  useCache?: boolean
}

export async function getInventoryItems(filters?: GetInventoryOptions) {
  const {
    bookingId,
    customerId,
    warehouseId,
    hallId,
    zoneId,
    status,
    search,
    limit = 50,
    offset = 0,
    useCache = true,
  } = filters || {}

  // Generate cache key
  const cacheKey = generateCacheKey(
    CACHE_PREFIXES.INVENTORY,
    bookingId || 'all',
    customerId || 'all',
    warehouseId || 'all',
    hallId || 'all',
    zoneId || 'all',
    status || 'all',
    search || 'all',
    limit,
    offset
  )

  // Try cache first
  if (useCache) {
    const cached = await getCache<InventoryItem[]>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const supabase = createServerSupabaseClient()
  let query = supabase
    .from('inventory_items')
    .select('*')
    .order('created_at', { ascending: false })

  if (bookingId) {
    query = query.eq('booking_id', bookingId)
  }
  if (customerId) {
    query = query.eq('customer_id', customerId)
  }
  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }
  if (hallId) {
    query = query.eq('hall_id', hallId)
  }
  if (zoneId) {
    query = query.eq('zone_id', zoneId)
  }
  if (status) {
    query = query.eq('status', status)
  }
  if (search) {
    query = query.or(`pallet_id.ilike.%${search}%,barcode.ilike.%${search}%,qr_code.ilike.%${search}%,location_code.ilike.%${search}%`)
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch inventory items: ${error.message}`)
  }

  const items = (data || []) as InventoryItem[]

  // Cache the result
  if (useCache) {
    await setCache(cacheKey, items, CACHE_TTL.SHORT)
  }

  return items
}

export async function getInventoryItemById(id: string) {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.INVENTORY, id)

  const cached = await getCache<InventoryItem>(cacheKey)
  if (cached) {
    return cached
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch inventory item: ${error.message}`)
  }

  const item = data as InventoryItem

  // Cache the result
  await setCache(cacheKey, item, CACHE_TTL.SHORT)

  return item
}

export async function searchInventoryByCode(code: string) {
  const supabase = createServerSupabaseClient()
  
  // Search by pallet_id, barcode, or qr_code
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .or(`pallet_id.eq.${code},barcode.eq.${code},qr_code.eq.${code}`)
    .limit(1)
    .single()

  if (error || !data) {
    throw new Error('Inventory item not found')
  }

  // Get booking information separately
  const { data: booking } = data.booking_id ? await supabase
    .from('bookings')
    .select('id, customer_name, customer_email, type')
    .eq('id', data.booking_id)
    .single() : { data: null }

  return {
    ...data,
    customer: booking?.customer_name || 'Unknown',
    type: data.item_type || booking?.type || 'General',
  } as InventoryItem & { customer: string; type: string }
}

export async function createInventoryItem(item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>) {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      ...item,
      received_at: item.status === 'received' ? new Date().toISOString() : null,
      stored_at: item.status === 'stored' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create inventory item: ${error.message}`)
  }

  // Invalidate cache
  await invalidateCache(CACHE_PREFIXES.INVENTORY)

  return data as InventoryItem
}

export async function updateInventoryItem(
  id: string,
  updates: Partial<Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>>
) {
  const supabase = createServerSupabaseClient()
  
  const updateData: any = { ...updates }
  
  // Update timestamps based on status changes
  if (updates.status === 'stored' && !updates.stored_at) {
    updateData.stored_at = new Date().toISOString()
  }
  if (updates.status === 'moved') {
    updateData.last_moved_at = new Date().toISOString()
  }
  if (updates.status === 'shipped') {
    updateData.shipped_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('inventory_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update inventory item: ${error.message}`)
  }

  // Invalidate cache
  await invalidateCache(CACHE_PREFIXES.INVENTORY)

  return data as InventoryItem
}

export async function createInventoryMovement(movement: Omit<InventoryMovement, 'id' | 'created_at'>) {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert(movement)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create inventory movement: ${error.message}`)
  }

  // Update the inventory item's last_moved_at
  await updateInventoryItem(movement.inventory_item_id, {
    last_moved_at: new Date().toISOString(),
  })

  // Invalidate cache
  await invalidateCache(CACHE_PREFIXES.INVENTORY)

  return data as InventoryMovement
}

export async function getInventoryMovements(itemId: string) {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('inventory_item_id', itemId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch inventory movements: ${error.message}`)
  }

  return (data || []) as InventoryMovement[]
}

export async function getInventoryStats(warehouseId?: string, hallId?: string) {
  const supabase = createServerSupabaseClient()
  
  let query = supabase
    .from('inventory_items')
    .select('status, hall_id, zone_id')

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }
  if (hallId) {
    query = query.eq('hall_id', hallId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch inventory stats: ${error.message}`)
  }

  const items = data || []
  
  const stats = {
    total: items.length,
    byStatus: {
      'in-transit': items.filter((i) => i.status === 'in-transit').length,
      received: items.filter((i) => i.status === 'received').length,
      stored: items.filter((i) => i.status === 'stored').length,
      moved: items.filter((i) => i.status === 'moved').length,
      shipped: items.filter((i) => i.status === 'shipped').length,
      damaged: items.filter((i) => i.status === 'damaged').length,
      lost: items.filter((i) => i.status === 'lost').length,
    },
    byHall: {} as Record<string, number>,
  }

  // Count by hall
  items.forEach((item) => {
    if (item.hall_id) {
      stats.byHall[item.hall_id] = (stats.byHall[item.hall_id] || 0) + 1
    }
  })

  return stats
}

