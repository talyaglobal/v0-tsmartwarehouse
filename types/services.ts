export type ServiceCategory = 
  | 'receiving'
  | 'putaway'
  | 'picking'
  | 'shipping'
  | 'repalletization'
  | 'labeling'
  | 'inventory'
  | 'cross-docking'
  | 'kitting'
  | 'returns'
  | 'quality-control'
  | 'temperature-control'
  | 'hazmat'
  | 'custom-packaging'
  | 'other'

export type ServiceUnitType = 
  | 'per-item'
  | 'per-pallet'
  | 'per-hour'
  | 'per-order'
  | 'flat-rate'

export type ServiceOrderStatus = 
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'in-progress'
  | 'completed'
  | 'cancelled'

export type ServiceOrderPriority = 
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent'

export interface WarehouseService {
  id: string
  code: string
  name: string
  description?: string
  category: ServiceCategory
  unitType: ServiceUnitType
  basePrice: number
  minQuantity: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ServiceOrderItem {
  id: string
  orderId: string
  serviceId: string
  serviceName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export interface ServiceOrder {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  bookingId?: string
  status: ServiceOrderStatus
  priority: ServiceOrderPriority
  requestedDate?: string
  dueDate?: string
  completedDate?: string
  notes?: string
  totalAmount: number
  items: ServiceOrderItem[]
  createdAt: string
  updatedAt: string
}

