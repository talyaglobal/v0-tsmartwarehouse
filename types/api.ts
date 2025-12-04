/**
 * Typed API Response interfaces
 */

import type { Booking, Task, Invoice, Incident, Claim, Notification, Payment, PaymentTransaction, Refund } from "./index"

// Base API Response
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  total?: number
  code?: string
}

// List Response (with pagination)
export interface ListResponse<T> extends ApiResponse<T[]> {
  data: T[]
  total: number
  page?: number
  limit?: number
  hasMore?: boolean
}

// Booking API Responses
export type BookingResponse = ApiResponse<Booking>
export type BookingsListResponse = ListResponse<Booking>

// Task API Responses
export type TaskResponse = ApiResponse<Task>
export type TasksListResponse = ListResponse<Task>

// Invoice API Responses
export type InvoiceResponse = ApiResponse<Invoice>
export type InvoicesListResponse = ListResponse<Invoice>

// Incident API Responses
export type IncidentResponse = ApiResponse<Incident>
export type IncidentsListResponse = ListResponse<Incident>

// Claim API Responses
export type ClaimResponse = ApiResponse<Claim>
export type ClaimsListResponse = ListResponse<Claim>

// Notification API Responses
export type NotificationResponse = ApiResponse<Notification>
export type NotificationsListResponse = ListResponse<Notification> & {
  unreadCount: number
}

// Payment API Responses
export type PaymentResponse = ApiResponse<Payment>
export type PaymentsListResponse = ListResponse<Payment>
export type PaymentHistoryResponse = ListResponse<PaymentTransaction>
export type RefundResponse = ApiResponse<Refund>
export type RefundsListResponse = ListResponse<Refund>

// Generic/Other API Responses
export type HealthResponse = ApiResponse<{
  status: string
  timestamp: string
  version: string
  services: {
    database: string
    storage: string
  }
}>

// Error Response
export interface ErrorResponse extends ApiResponse {
  success: false
  error: string
  code?: string
  statusCode: number
}

