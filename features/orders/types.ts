import type {
  ServiceOrder,
  ServiceOrderStatus,
  ServiceOrderPriority,
  ServiceOrderItem,
} from '@/types'

export type { ServiceOrder, ServiceOrderStatus, ServiceOrderPriority, ServiceOrderItem }

export interface ServiceOrderFilters {
  customerId?: string
  status?: ServiceOrderStatus
  bookingId?: string
  limit?: number
  offset?: number
}

export interface CreateServiceOrderInput {
  bookingId?: string
  status?: ServiceOrderStatus
  priority?: ServiceOrderPriority
  requestedDate?: string
  dueDate?: string
  notes?: string
  items: Array<{
    serviceId: string
    serviceName: string
    quantity: number
    unitPrice: number
    totalPrice: number
    notes?: string
  }>
}

export interface UpdateServiceOrderInput {
  status?: ServiceOrderStatus
  priority?: ServiceOrderPriority
  requestedDate?: string
  dueDate?: string
  completedDate?: string
  notes?: string
  totalAmount?: number
}

