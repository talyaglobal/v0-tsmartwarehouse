// Core Enums
export type UserRole = "super_admin" | "admin" | "worker" | "customer"
export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled"
export type PaymentStatus = "pending" | "partial" | "paid" | "overdue" | "refunded"
export type ItemCondition = "excellent" | "good" | "fair" | "damaged"
export type MembershipTier = "bronze" | "silver" | "gold" | "platinum"
export type IncidentType = "damage" | "loss" | "theft" | "other"
export type IncidentSeverity = "low" | "medium" | "high" | "critical"
export type ClaimStatus = "submitted" | "under_review" | "approved" | "denied" | "paid"
export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked"
export type TaskPriority = "low" | "medium" | "high" | "urgent"
export type NotificationType = "booking" | "payment" | "incident" | "task" | "system"

// Address Type
export interface Address {
  street: string
  city: string
  state: string
  postal_code: string
  country: string
  lat?: number
  lng?: number
}

// Dimensions
export interface Dimensions {
  length: number
  width: number
  height: number
  unit: "in" | "cm"
}

// Operating Hours
export interface OperatingHours {
  monday: DayHours
  tuesday: DayHours
  wednesday: DayHours
  thursday: DayHours
  friday: DayHours
  saturday: DayHours
  sunday: DayHours
}

export interface DayHours {
  open: string
  close: string
  is_closed: boolean
}

// Pagination
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// API Response
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  meta?: {
    timestamp: string
    requestId: string
  }
}

// Filter Types
export interface DateRangeFilter {
  from?: string
  to?: string
}

export interface SearchFilter {
  query: string
  fields: string[]
}
