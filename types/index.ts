// Core Types for TSmart Warehouse Management System

// User Types
export type UserRole = "admin" | "customer" | "worker"
export type MembershipTier = "bronze" | "silver" | "gold" | "platinum"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  companyId?: string
  companyName?: string
  companyRole?: 'owner' | 'admin' | 'member' | null // Role in company (from company_members table)
  phone?: string
  avatar?: string
  membershipTier?: MembershipTier
  creditBalance?: number
  createdAt: string
  updatedAt: string
}

// Warehouse Layout - 3 Floors, 2 Halls x 40,000 sq ft = 240,000 sq ft total
export interface WarehouseFloor {
  id: string
  floorNumber: 1 | 2 | 3
  name: string
  halls: WarehouseHall[]
  totalSqFt: number // 80,000 sq ft per floor
}

export interface WarehouseHall {
  id: string
  floorId: string
  hallName: "A" | "B"
  sqFt: number // 40,000 sq ft each
  availableSqFt: number
  occupiedSqFt: number
  zones: WarehouseZone[]
}

export interface WarehouseZone {
  id: string
  hallId: string
  name: string
  type: "pallet" | "area-rental" | "cold-storage" | "hazmat"
  totalSlots?: number
  availableSlots?: number
  totalSqFt?: number
  availableSqFt?: number
}

export interface Warehouse {
  id: string
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  totalSqFt: number // 240,000 sq ft
  floors: WarehouseFloor[]
  amenities: string[]
  operatingHours: {
    open: string
    close: string
    days: string[]
  }
}

// Booking Types
export type BookingStatus = "pending" | "confirmed" | "active" | "completed" | "cancelled"
export type BookingType = "pallet" | "area-rental"
export type ServiceType = "pallet-in" | "storage" | "pallet-out" | "area-rental"

export interface Booking {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  warehouseId: string
  type: BookingType
  status: BookingStatus
  // Pallet booking fields
  palletCount?: number
  // Area rental fields (Level 3 only, min 40,000 sq ft)
  areaSqFt?: number
  floorNumber?: 3
  hallId?: string
  // Common fields
  startDate: string
  endDate?: string
  totalAmount: number
  notes?: string
  createdAt: string
  updatedAt: string
}

// Pricing Configuration
export interface PricingConfig {
  // Pallet Services
  palletIn: number // $5.00
  palletOut: number // $5.00
  storagePerPalletPerMonth: number // $17.50
  // Area Rental (Level 3 only)
  areaRentalPerSqFtPerYear: number // $20.00
  areaRentalMinSqFt: number // 40,000 sq ft
  // Discounts
  volumeDiscounts: {
    palletThreshold: number
    discountPercent: number
  }[]
  membershipDiscounts: {
    tier: MembershipTier
    discountPercent: number
  }[]
}

// Invoice Types
export type InvoiceStatus = "draft" | "pending" | "paid" | "overdue" | "cancelled"

export interface Invoice {
  id: string
  bookingId: string
  customerId: string
  customerName: string
  status: InvoiceStatus
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  dueDate: string
  paidDate?: string
  createdAt: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

// Task Types (Worker Tasks)
export type TaskStatus = "pending" | "assigned" | "in-progress" | "completed" | "cancelled"
export type TaskPriority = "low" | "normal" | "medium" | "high" | "urgent"
export type TaskType = "receiving" | "putaway" | "picking" | "packing" | "shipping" | "inventory-check" | "maintenance"

export interface Task {
  id: string
  type: TaskType
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignedTo?: string
  assignedToName?: string
  bookingId?: string
  warehouseId: string
  zone?: string
  location?: string
  dueDate?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

// Incident & Claims
export type IncidentSeverity = "low" | "medium" | "high" | "critical"
export type IncidentStatus = "open" | "investigating" | "resolved" | "closed"
export type ClaimStatus = "submitted" | "under-review" | "approved" | "rejected" | "paid"

export interface Incident {
  id: string
  type: string
  title: string
  description: string
  severity: IncidentSeverity
  status: IncidentStatus
  reportedBy: string
  reportedByName: string
  warehouseId: string
  location?: string
  affectedBookingId?: string
  resolution?: string
  createdAt: string
  resolvedAt?: string
}

export interface Claim {
  id: string
  customerId: string
  customerName: string
  incidentId?: string
  bookingId: string
  type: string
  description: string
  amount: number
  status: ClaimStatus
  evidence?: string[]
  resolution?: string
  approvedAmount?: number
  createdAt: string
  resolvedAt?: string
}

// Notification Types
export type NotificationChannel = "email" | "sms" | "push" | "whatsapp"
export type NotificationType = "booking" | "invoice" | "task" | "incident" | "system"

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  channel: NotificationChannel
  title: string
  message: string
  read: boolean
  createdAt: string
}

// Worker Shift
export interface WorkerShift {
  id: string
  workerId: string
  workerName: string
  checkInTime: string
  checkOutTime?: string
  hoursWorked?: number
  breaks: { start: string; end: string }[]
  tasksCompleted: number
  warehouseId: string
}

// Analytics Types
export interface DashboardStats {
  totalBookings: number
  activeBookings: number
  totalRevenue: number
  monthlyRevenue: number
  totalCustomers: number
  warehouseUtilization: number
  pendingTasks: number
  openIncidents: number
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Payment Types
export type PaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "refunded" | "partially_refunded"
export type PaymentMethod = "card" | "credit_balance" | "bank_transfer" | "other"
export type RefundStatus = "pending" | "succeeded" | "failed" | "cancelled"

export interface Payment {
  id: string
  invoiceId: string
  customerId: string
  amount: number
  currency: string
  status: PaymentStatus
  paymentMethod: PaymentMethod
  stripePaymentIntentId?: string
  stripeChargeId?: string
  creditBalanceUsed?: number
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface PaymentTransaction {
  id: string
  paymentId: string
  type: "payment" | "refund" | "credit_adjustment"
  amount: number
  currency: string
  status: PaymentStatus
  description: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface Refund {
  id: string
  paymentId: string
  invoiceId: string
  customerId: string
  amount: number
  currency: string
  reason?: string
  status: RefundStatus
  stripeRefundId?: string
  metadata?: Record<string, any>
  createdAt: string
  processedAt?: string
}
