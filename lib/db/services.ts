import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { WarehouseService, ServiceCategory } from '@/types'
import { getCache, setCache, invalidateCache, generateCacheKey, CACHE_TTL } from '@/lib/cache/redis'

/**
 * Database operations for Warehouse Services
 */

interface GetServicesOptions {
  category?: ServiceCategory
  isActive?: boolean
  limit?: number
  offset?: number
  useCache?: boolean
}

/**
 * Transform database row to WarehouseService type
 */
function transformServiceRow(row: any): WarehouseService {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || undefined,
    category: row.category as ServiceCategory,
    unitType: row.unit_type,
    basePrice: parseFloat(row.base_price),
    minQuantity: row.min_quantity || 1,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Get all warehouse services with optional filtering
 */
export async function getServices(filters?: GetServicesOptions): Promise<WarehouseService[]> {
  const {
    category,
    isActive = true,
    limit,
    offset = 0,
    useCache = true,
  } = filters || {}

  // Generate cache key
  const cacheKey = generateCacheKey(
    'services',
    category || 'all',
    isActive ? 'active' : 'all',
    limit || 'all',
    offset
  )

  // Try cache first
  if (useCache) {
    const cached = await getCache<WarehouseService[]>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('warehouse_services')
    .select('*')
    .order('name', { ascending: true })

  if (isActive !== undefined) {
    query = query.eq('is_active', isActive)
  }

  if (category) {
    query = query.eq('category', category)
  }

  if (limit) {
    query = query.limit(limit).range(offset, offset + limit - 1)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch services: ${error.message}`)
  }

  const services = (data || []).map(transformServiceRow)

  // Cache the result
  if (useCache) {
    await setCache(cacheKey, services, CACHE_TTL.MEDIUM)
  }

  return services
}

/**
 * Get a single service by ID
 */
export async function getServiceById(id: string, useCache: boolean = true): Promise<WarehouseService | null> {
  const cacheKey = generateCacheKey('service', id)

  if (useCache) {
    const cached = await getCache<WarehouseService>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('warehouse_services')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch service: ${error.message}`)
  }

  const service = data ? transformServiceRow(data) : null

  // Cache the result
  if (service && useCache) {
    await setCache(cacheKey, service, CACHE_TTL.MEDIUM)
  }

  return service
}

/**
 * Create a new service (admin only)
 */
export async function createService(service: Omit<WarehouseService, 'id' | 'createdAt' | 'updatedAt'>): Promise<WarehouseService> {
  const supabase = createServerSupabaseClient()

  const serviceRow = {
    code: service.code,
    name: service.name,
    description: service.description || null,
    category: service.category,
    unit_type: service.unitType,
    base_price: service.basePrice,
    min_quantity: service.minQuantity || 1,
    is_active: service.isActive ?? true,
  }

  const { data, error } = await supabase
    .from('warehouse_services')
    .insert(serviceRow)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create service: ${error.message}`)
  }

  // Invalidate cache
  await invalidateCache('services')

  return transformServiceRow(data)
}

/**
 * Update an existing service (admin only)
 */
export async function updateService(
  id: string,
  updates: Partial<Omit<WarehouseService, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<WarehouseService> {
  const supabase = createServerSupabaseClient()

  const updateRow: any = {}

  if (updates.code !== undefined) updateRow.code = updates.code
  if (updates.name !== undefined) updateRow.name = updates.name
  if (updates.description !== undefined) updateRow.description = updates.description || null
  if (updates.category !== undefined) updateRow.category = updates.category
  if (updates.unitType !== undefined) updateRow.unit_type = updates.unitType
  if (updates.basePrice !== undefined) updateRow.base_price = updates.basePrice
  if (updates.minQuantity !== undefined) updateRow.min_quantity = updates.minQuantity
  if (updates.isActive !== undefined) updateRow.is_active = updates.isActive

  const { data, error } = await supabase
    .from('warehouse_services')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update service: ${error.message}`)
  }

  // Invalidate cache
  await invalidateCache('services')
  await invalidateCache(`service:${id}`)

  return transformServiceRow(data)
}

/**
 * Delete a service (admin only)
 */
export async function deleteService(id: string): Promise<void> {
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from('warehouse_services')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete service: ${error.message}`)
  }

  // Invalidate cache
  await invalidateCache('services')
  await invalidateCache(`service:${id}`)
}

