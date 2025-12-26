import {
  getServiceOrders,
  getServiceOrderById,
  createServiceOrder,
  updateServiceOrder,
  cancelServiceOrder,
} from '@/lib/db/orders'
import type { ServiceOrderStatus } from '@/types'

export async function fetchServiceOrders(filters?: {
  customerId?: string
  status?: ServiceOrderStatus
  bookingId?: string
  limit?: number
  offset?: number
}) {
  return getServiceOrders(filters)
}

export async function fetchServiceOrderById(id: string) {
  return getServiceOrderById(id)
}

export async function createNewServiceOrder(
  order: Parameters<typeof createServiceOrder>[0],
  items: Parameters<typeof createServiceOrder>[1]
) {
  return createServiceOrder(order, items)
}

export async function updateExistingServiceOrder(
  id: string,
  updates: Parameters<typeof updateServiceOrder>[1]
) {
  return updateServiceOrder(id, updates)
}

export async function cancelExistingServiceOrder(id: string) {
  return cancelServiceOrder(id)
}

