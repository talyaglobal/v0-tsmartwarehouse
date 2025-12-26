import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ServiceOrder, ServiceOrderItem, ServiceOrderStatus } from '@/types'
import { getCache, setCache, invalidateCache, generateCacheKey, CACHE_TTL } from '@/lib/cache/redis'

/**
 * Database operations for Service Orders
 */

interface GetServiceOrdersOptions {
  customerId?: string
  status?: ServiceOrderStatus
  bookingId?: string
  limit?: number
  offset?: number
  useCache?: boolean
}

/**
 * Transform service order item row to ServiceOrderItem type
 */
function transformOrderItemRow(row: any): ServiceOrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    quantity: parseFloat(row.quantity),
    unitPrice: parseFloat(row.unit_price),
    totalPrice: parseFloat(row.total_price),
    notes: row.notes || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Transform service order row to ServiceOrder type
 */
function transformOrderRow(row: any, items: ServiceOrderItem[] = []): ServiceOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    bookingId: row.booking_id || undefined,
    status: row.status as ServiceOrderStatus,
    priority: row.priority,
    requestedDate: row.requested_date || undefined,
    dueDate: row.due_date || undefined,
    completedDate: row.completed_date || undefined,
    notes: row.notes || undefined,
    totalAmount: parseFloat(row.total_amount),
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Get all service orders with optional filtering
 */
export async function getServiceOrders(filters?: GetServiceOrdersOptions): Promise<ServiceOrder[]> {
  const {
    customerId,
    status,
    bookingId,
    limit,
    offset = 0,
    useCache = true,
  } = filters || {}

  // Generate cache key
  const cacheKey = generateCacheKey(
    'service-orders',
    customerId || 'all',
    status || 'all',
    bookingId || 'all',
    limit || 'all',
    offset
  )

  // Try cache first
  if (useCache) {
    const cached = await getCache<ServiceOrder[]>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('service_orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (customerId) {
    query = query.eq('customer_id', customerId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (bookingId) {
    query = query.eq('booking_id', bookingId)
  }

  if (limit) {
    query = query.limit(limit).range(offset, offset + limit - 1)
  }

  const { data: ordersData, error: ordersError } = await query

  if (ordersError) {
    throw new Error(`Failed to fetch service orders: ${ordersError.message}`)
  }

  if (!ordersData || ordersData.length === 0) {
    return []
  }

  // Fetch items for all orders
  const orderIds = ordersData.map((o: any) => o.id)
  const { data: itemsData, error: itemsError } = await supabase
    .from('service_order_items')
    .select('*')
    .in('order_id', orderIds)

  if (itemsError) {
    throw new Error(`Failed to fetch order items: ${itemsError.message}`)
  }

  // Group items by order_id
  const itemsByOrderId = new Map<string, ServiceOrderItem[]>()
  if (itemsData) {
    itemsData.forEach((item: any) => {
      const transformed = transformOrderItemRow(item)
      const existing = itemsByOrderId.get(item.order_id) || []
      existing.push(transformed)
      itemsByOrderId.set(item.order_id, existing)
    })
  }

  // Transform orders with their items
  const orders = ordersData.map((row: any) => 
    transformOrderRow(row, itemsByOrderId.get(row.id) || [])
  )

  // Cache the result
  if (useCache) {
    await setCache(cacheKey, orders, CACHE_TTL.MEDIUM)
  }

  return orders
}

/**
 * Get a single service order by ID
 */
export async function getServiceOrderById(id: string, useCache: boolean = true): Promise<ServiceOrder | null> {
  const cacheKey = generateCacheKey('service-order', id)

  if (useCache) {
    const cached = await getCache<ServiceOrder>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const supabase = createServerSupabaseClient()

  // Fetch order
  const { data: orderData, error: orderError } = await supabase
    .from('service_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (orderError) {
    if (orderError.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch service order: ${orderError.message}`)
  }

  if (!orderData) {
    return null
  }

  // Fetch items
  const { data: itemsData, error: itemsError } = await supabase
    .from('service_order_items')
    .select('*')
    .eq('order_id', id)

  if (itemsError) {
    throw new Error(`Failed to fetch order items: ${itemsError.message}`)
  }

  const items = (itemsData || []).map(transformOrderItemRow)
  const order = transformOrderRow(orderData, items)

  // Cache the result
  if (useCache) {
    await setCache(cacheKey, order, CACHE_TTL.MEDIUM)
  }

  return order
}

/**
 * Create a new service order with items
 */
export async function createServiceOrder(
  order: Omit<ServiceOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'items'>,
  items: Omit<ServiceOrderItem, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>[]
): Promise<ServiceOrder> {
  const supabase = createServerSupabaseClient()

  // Create order (order_number will be auto-generated by trigger)
  const orderRow = {
    customer_id: order.customerId,
    customer_name: order.customerName,
    booking_id: order.bookingId || null,
    status: order.status,
    priority: order.priority,
    requested_date: order.requestedDate || null,
    due_date: order.dueDate || null,
    notes: order.notes || null,
    total_amount: order.totalAmount,
  }

  const { data: orderData, error: orderError } = await supabase
    .from('service_orders')
    .insert(orderRow)
    .select()
    .single()

  if (orderError) {
    throw new Error(`Failed to create service order: ${orderError.message}`)
  }

  // Create order items
  if (items.length > 0) {
    const itemsRows = items.map(item => ({
      order_id: orderData.id,
      service_id: item.serviceId,
      service_name: item.serviceName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      notes: item.notes || null,
      status: item.status || 'pending',
    }))

    const { error: itemsError } = await supabase
      .from('service_order_items')
      .insert(itemsRows)

    if (itemsError) {
      // Rollback order creation
      await supabase.from('service_orders').delete().eq('id', orderData.id)
      throw new Error(`Failed to create order items: ${itemsError.message}`)
    }
  }

  // Fetch the complete order with items
  const newOrder = await getServiceOrderById(orderData.id, false)

  if (!newOrder) {
    throw new Error('Failed to fetch created order')
  }

  // Invalidate cache
  await invalidateCache('service-orders')

  return newOrder
}

/**
 * Update an existing service order
 */
export async function updateServiceOrder(
  id: string,
  updates: Partial<Omit<ServiceOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt' | 'items'>>
): Promise<ServiceOrder> {
  const supabase = createServerSupabaseClient()

  const updateRow: Record<string, any> = {}

  if (updates.customerId !== undefined) updateRow.customer_id = updates.customerId
  if (updates.customerName !== undefined) updateRow.customer_name = updates.customerName
  if (updates.bookingId !== undefined) updateRow.booking_id = updates.bookingId || null
  if (updates.status !== undefined) updateRow.status = updates.status
  if (updates.priority !== undefined) updateRow.priority = updates.priority
  if (updates.requestedDate !== undefined) updateRow.requested_date = updates.requestedDate || null
  if (updates.dueDate !== undefined) updateRow.due_date = updates.dueDate || null
  if (updates.completedDate !== undefined) updateRow.completed_date = updates.completedDate || null
  if (updates.notes !== undefined) updateRow.notes = updates.notes || null
  if (updates.totalAmount !== undefined) updateRow.total_amount = updates.totalAmount

  const { error } = await supabase
    .from('service_orders')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update service order: ${error.message}`)
  }

  // Invalidate cache
  await invalidateCache('service-orders')
  await invalidateCache(`service-order:${id}`)

  // Fetch the complete order with items
  const updatedOrder = await getServiceOrderById(id, false)

  if (!updatedOrder) {
    throw new Error('Failed to fetch updated order')
  }

  return updatedOrder
}

/**
 * Cancel a service order
 */
export async function cancelServiceOrder(id: string): Promise<ServiceOrder> {
  return updateServiceOrder(id, { 
    status: 'cancelled',
    completedDate: new Date().toISOString().split('T')[0]
  })
}

