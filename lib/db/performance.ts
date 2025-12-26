import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getCache, setCache, generateCacheKey, CACHE_PREFIXES, CACHE_TTL } from '@/lib/cache/redis'

/**
 * Database operations for Performance Metrics with caching
 */

export interface PerformanceFilters {
  floor?: number
  warehouseId?: string
  customerId?: string
  brokerId?: string
  customerGroupId?: string
}

export interface PerformanceMetrics {
  targetCapacity: number
  currentUtilization: number
  utilizationPercent: number
  totalCapacity: number
  occupiedCapacity: number
  availableCapacity: number
}

export interface Broker {
  id: string
  name: string
  email?: string
  company?: string
  phone?: string
}

export interface CustomerGroup {
  id: string
  name: string
  description?: string
}

/**
 * Get performance metrics with filters
 */
export async function getPerformanceMetrics(
  filters: PerformanceFilters = {}
): Promise<PerformanceMetrics> {
  const cacheKey = generateCacheKey(
    CACHE_PREFIXES.DASHBOARD_STATS,
    'performance',
    JSON.stringify(filters)
  )

  const cached = await getCache<PerformanceMetrics>(cacheKey)
  if (cached) {
    return cached
  }

  const supabase = createServerSupabaseClient()

  // Get target capacity based on filters
  const targetCapacity = await getTargetCapacity(filters)

  // Get actual capacity and utilization
  let totalCapacity = 0
  let occupiedCapacity = 0

  // If filtering by floor
  if (filters.floor) {
    const { data: floors, error: floorsError } = await supabase
      .from('warehouse_floors')
      .select('id')
      .eq('floor_number', filters.floor)

    if (floorsError) {
      throw new Error(`Failed to fetch floors: ${floorsError.message}`)
    }

    const floorIds = floors?.map(f => f.id) || []

    if (floorIds.length > 0) {
      const { data: halls, error: hallsError } = await supabase
        .from('warehouse_halls')
        .select('sq_ft, occupied_sq_ft')
        .in('floor_id', floorIds)

      if (hallsError) {
        throw new Error(`Failed to fetch halls: ${hallsError.message}`)
      }

      totalCapacity = halls?.reduce((sum, hall) => sum + (hall.sq_ft || 0), 0) || 0
      occupiedCapacity = halls?.reduce((sum, hall) => sum + (hall.occupied_sq_ft || 0), 0) || 0
    }
  }
  // If filtering by warehouse
  else if (filters.warehouseId) {
    const { data: floors, error: floorsError } = await supabase
      .from('warehouse_floors')
      .select('id')
      .eq('warehouse_id', filters.warehouseId)

    if (floorsError) {
      throw new Error(`Failed to fetch floors: ${floorsError.message}`)
    }

    const floorIds = floors?.map(f => f.id) || []

    if (floorIds.length > 0) {
      const { data: halls, error: hallsError } = await supabase
        .from('warehouse_halls')
        .select('sq_ft, occupied_sq_ft')
        .in('floor_id', floorIds)

      if (hallsError) {
        throw new Error(`Failed to fetch halls: ${hallsError.message}`)
      }

      totalCapacity = halls?.reduce((sum, hall) => sum + (hall.sq_ft || 0), 0) || 0
      occupiedCapacity = halls?.reduce((sum, hall) => sum + (hall.occupied_sq_ft || 0), 0) || 0
    }
  }
  // If filtering by customer, broker, or customer group
  else if (filters.customerId || filters.brokerId || filters.customerGroupId) {
    // Get bookings for the filtered customers
    let customerIds: string[] = []

    if (filters.customerId) {
      customerIds = [filters.customerId]
    } else if (filters.brokerId) {
      // Get customers linked to this broker
      const { data: brokerCustomers, error: brokerError } = await supabase
        .from('broker_customers')
        .select('customer_id')
        .eq('broker_id', filters.brokerId)

      if (brokerError) {
        throw new Error(`Failed to fetch broker customers: ${brokerError.message}`)
      }

      customerIds = brokerCustomers?.map(bc => bc.customer_id) || []
    } else if (filters.customerGroupId) {
      // Get customers in this group
      const { data: groupMembers, error: groupError } = await supabase
        .from('customer_group_members')
        .select('customer_id')
        .eq('group_id', filters.customerGroupId)

      if (groupError) {
        throw new Error(`Failed to fetch group members: ${groupError.message}`)
      }

      customerIds = groupMembers?.map(gm => gm.customer_id) || []
    }

    if (customerIds.length > 0) {
      // Get bookings for these customers
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('area_sq_ft, pallet_count, hall_id')
        .in('customer_id', customerIds)
        .in('status', ['confirmed', 'active'])

      if (bookingsError) {
        throw new Error(`Failed to fetch bookings: ${bookingsError.message}`)
      }

      // Calculate occupied capacity from bookings
      occupiedCapacity = bookings?.reduce((sum, booking) => {
        if (booking.area_sq_ft) {
          return sum + booking.area_sq_ft
        } else if (booking.pallet_count) {
          // Estimate: 1 pallet = ~32 sq ft
          return sum + (booking.pallet_count * 32)
        }
        return sum
      }, 0) || 0

      // Get total capacity from all warehouses (for customer/broker/group view)
      const { data: halls, error: hallsError } = await supabase
        .from('warehouse_halls')
        .select('sq_ft')

      if (hallsError) {
        throw new Error(`Failed to fetch halls: ${hallsError.message}`)
      }

      totalCapacity = halls?.reduce((sum, hall) => sum + (hall.sq_ft || 0), 0) || 0
    }
  }
  // All warehouse (default)
  else {
    const { data: halls, error: hallsError } = await supabase
      .from('warehouse_halls')
      .select('sq_ft, occupied_sq_ft')

    if (hallsError) {
      throw new Error(`Failed to fetch halls: ${hallsError.message}`)
    }

    totalCapacity = halls?.reduce((sum, hall) => sum + (hall.sq_ft || 0), 0) || 0
    occupiedCapacity = halls?.reduce((sum, hall) => sum + (hall.occupied_sq_ft || 0), 0) || 0
  }

  const availableCapacity = totalCapacity - occupiedCapacity
  const utilizationPercent = totalCapacity > 0 
    ? Math.round((occupiedCapacity / totalCapacity) * 100 * 100) / 100 
    : 0

  const result: PerformanceMetrics = {
    targetCapacity,
    currentUtilization: utilizationPercent,
    utilizationPercent,
    totalCapacity,
    occupiedCapacity,
    availableCapacity,
  }

  await setCache(cacheKey, result, CACHE_TTL.SHORT)
  return result
}

/**
 * Get target capacity based on filters
 */
export async function getTargetCapacity(
  filters: PerformanceFilters = {}
): Promise<number> {
  const supabase = createServerSupabaseClient()

  // Determine filter type
  let filterType: 'all' | 'floor' | 'warehouse' | 'customer' | 'broker' | 'customer_group' = 'all'
  let filterId: string | null = null

  if (filters.floor) {
    filterType = 'floor'
    filterId = null // Floor number is in the floor_number column
  } else if (filters.warehouseId) {
    filterType = 'warehouse'
    filterId = filters.warehouseId
  } else if (filters.customerId) {
    filterType = 'customer'
    filterId = filters.customerId
  } else if (filters.brokerId) {
    filterType = 'broker'
    filterId = filters.brokerId
  } else if (filters.customerGroupId) {
    filterType = 'customer_group'
    filterId = filters.customerGroupId
  }

  // Try to get specific target
  let query = supabase
    .from('performance_targets')
    .select('target_capacity_percent')
    .eq('filter_type', filterType)

  if (filters.floor) {
    query = query.eq('floor_number', filters.floor)
  } else if (filters.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId)
  }

  if (filterId) {
    query = query.eq('filter_id', filterId)
  } else if (filterType !== 'all' && filterType !== 'floor') {
    query = query.is('filter_id', null)
  }

  const { data: target, error } = await query.maybeSingle()

  if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" which is OK
    throw new Error(`Failed to fetch target capacity: ${error.message}`)
  }

  // Return configured target or default
  return target?.target_capacity_percent ? parseFloat(target.target_capacity_percent.toString()) : 80.0
}

/**
 * Get list of brokers
 */
export async function getBrokers(): Promise<Broker[]> {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.DASHBOARD_STATS, 'brokers')

  const cached = await getCache<Broker[]>(cacheKey)
  if (cached) {
    return cached
  }

  const supabase = createServerSupabaseClient()

  const { data: brokers, error } = await supabase
    .from('brokers')
    .select('id, name, email, company, phone')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch brokers: ${error.message}`)
  }

  const result = (brokers || []) as Broker[]

  await setCache(cacheKey, result, CACHE_TTL.MEDIUM)
  return result
}

/**
 * Get list of customer groups
 */
export async function getCustomerGroups(): Promise<CustomerGroup[]> {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.DASHBOARD_STATS, 'customer-groups')

  const cached = await getCache<CustomerGroup[]>(cacheKey)
  if (cached) {
    return cached
  }

  const supabase = createServerSupabaseClient()

  const { data: groups, error } = await supabase
    .from('customer_groups')
    .select('id, name, description')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch customer groups: ${error.message}`)
  }

  const result = (groups || []) as CustomerGroup[]

  await setCache(cacheKey, result, CACHE_TTL.MEDIUM)
  return result
}

