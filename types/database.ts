// Database types for TSmart Warehouse

export type UserRole = "CUSTOMER" | "ADMIN" | "OP_MANAGER" | "FINANCE" | "WORKER"
export type BookingType = "PALLET" | "CONTAINER"
export type BookingStatus = "DRAFT" | "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "IN_PROGRESS" | "COMPLETED"
export type PaymentStatus = "NOT_PAID" | "PAID" | "REFUNDED" | "FAILED"
export type ProductType = "AMBIENT_FOOD" | "FROZEN" | "ELECTRONICS" | "FRAGILE" | "GENERAL"
export type PalletSize = "STANDARD" | "OVERSIZED"
export type TaskStatus = "TODO" | "IN_PROGRESS" | "PAUSED" | "DONE" | "CANCELLED"
export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED"
export type IncidentType = "DAMAGE" | "DELAY" | "SAFETY" | "MISSING_ITEMS" | "MISPICK" | "EQUIPMENT_FAILURE" | "OTHER"
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
export type IncidentStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "ESCALATED" | "CLOSED"
export type ClaimStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "PAID" | "CLOSED"

export interface Profile {
  id: string
  created_at: string
  updated_at: string
  full_name: string | null
  phone: string | null
  role: UserRole
  company_id: string | null
  employee_id: string | null
  hourly_rate: number | null
  overtime_rate: number | null
  notify_via_email: boolean
  notify_via_whatsapp: boolean
  notify_via_sms: boolean
  whatsapp_number: string | null
  is_active: boolean
}

export interface Company {
  id: string
  created_at: string
  updated_at: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string
  tax_id: string | null
  phone: string | null
  email: string | null
  website: string | null
  quickbooks_customer_id: string | null
  is_active: boolean
}

export interface Membership {
  id: string
  created_at: string
  updated_at: string
  company_id: string
  credit_limit: number
  credit_used: number
  status: MembershipStatus
  payment_terms_days: number
  discount_percentage: number
}

export interface Warehouse {
  id: string
  created_at: string
  updated_at: string
  name: string
  location: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  total_sqft: number
  max_pallets: number
  max_containers: number
  docks_count: number
  working_hours_start: string
  working_hours_end: string
  is_active: boolean
}

export interface Dock {
  id: string
  created_at: string
  updated_at: string
  warehouse_id: string
  name: string
  number: number
  is_active: boolean
}

export interface PricingRule {
  id: string
  created_at: string
  updated_at: string
  product_type: ProductType
  pallet_size: PalletSize
  base_price_per_day: number
  price_per_kg: number
  price_per_height_cm: number
  multiplier: number
  is_active: boolean
  effective_from: string
  effective_until: string | null
  notes: string | null
}

export interface Booking {
  id: string
  created_at: string
  updated_at: string
  company_id: string
  warehouse_id: string
  dock_id: string | null
  booking_number: string
  type: BookingType
  booking_date: string
  start_time: string
  end_time: string
  duration_days: number
  pallets_count: number
  containers_count: number
  container_number: string | null
  seal_number: string | null
  status: BookingStatus
  total_price: number
  payment_status: PaymentStatus
  payment_method: string | null
  stripe_payment_intent_id: string | null
  notes: string | null
  customer_notes: string | null
  confirmed_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
}

export interface Product {
  id: string
  created_at: string
  updated_at: string
  booking_id: string
  product_type: ProductType
  pallet_size: PalletSize
  weight_kg: number
  height_cm: number
  quantity: number
  description: string | null
  sku: string | null
  base_price: number | null
  weight_charge: number | null
  height_charge: number | null
  line_total: number | null
}

export interface Invoice {
  id: string
  created_at: string
  updated_at: string
  company_id: string
  booking_id: string
  invoice_number: string
  issue_date: string
  due_date: string
  subtotal: number
  tax: number
  tax_rate: number
  discount: number
  total: number
  paid_at: string | null
  paid_amount: number | null
  pdf_url: string | null
  quickbooks_invoice_id: string | null
  notes: string | null
}

export interface Task {
  id: string
  created_at: string
  updated_at: string
  warehouse_id: string
  assigned_to_user_id: string | null
  booking_id: string | null
  type: string
  title: string
  description: string | null
  status: TaskStatus
  priority: string
  estimated_duration: number | null
  actual_duration: number | null
  start_time: string | null
  end_time: string | null
  dock_id: string | null
  location_notes: string | null
  completion_notes: string | null
  completed_by_user_id: string | null
}

export interface TimeLog {
  id: string
  created_at: string
  user_id: string
  warehouse_id: string
  clock_in: string
  clock_out: string | null
  total_hours: number | null
  clock_in_location: string | null
  clock_out_location: string | null
  notes: string | null
}

export interface Incident {
  id: string
  created_at: string
  updated_at: string
  incident_number: string
  warehouse_id: string
  booking_id: string | null
  task_id: string | null
  reported_by_user_id: string
  assigned_to_user_id: string | null
  type: IncidentType
  severity: IncidentSeverity
  status: IncidentStatus
  title: string
  description: string
  initial_action: string | null
  occurred_at: string
  reported_at: string
  reviewed_at: string | null
  resolved_at: string | null
  resolution_summary: string | null
  root_cause: string | null
  estimated_cost: number | null
  actual_cost: number | null
  customer_notified: boolean
  customer_notified_at: string | null
}

export interface Claim {
  id: string
  created_at: string
  updated_at: string
  claim_number: string
  company_id: string
  booking_id: string | null
  incident_id: string | null
  status: ClaimStatus
  claim_reason: string
  description: string | null
  claimed_amount: number
  approved_amount: number | null
  currency: string
  submitted_at: string | null
  reviewed_at: string | null
  approved_at: string | null
  rejected_at: string | null
  paid_at: string | null
  rejection_reason: string | null
  reviewed_by_user_id: string | null
  approved_by_user_id: string | null
  notes: string | null
}
