import type { BookingStatus, PaymentStatus, ItemCondition, Dimensions } from "../common/types"

export interface Booking {
  id: string
  booking_number: string
  customer_id: string
  warehouse_id: string
  storage_unit_id?: string
  service_type: "storage" | "fulfillment" | "cross_dock" | "value_added"
  status: BookingStatus
  start_date: string
  end_date?: string
  estimated_items: number
  actual_items?: number
  special_instructions?: string
  total_amount: number
  deposit_amount: number
  payment_status: PaymentStatus
  created_at: string
  updated_at: string
}

export interface BookingItem {
  id: string
  booking_id: string
  sku: string
  name: string
  description?: string
  quantity: number
  weight_lbs: number
  dimensions: Dimensions
  condition: ItemCondition
  condition_notes?: string
  photo_urls: string[]
  barcode?: string
  location?: string
  checked_in_at?: string
  checked_in_by?: string
  checked_out_at?: string
  checked_out_by?: string
}

export interface CreateBookingRequest {
  customer_id: string
  warehouse_id: string
  service_type: Booking["service_type"]
  start_date: string
  end_date?: string
  estimated_items: number
  special_instructions?: string
  storage_unit_id?: string
}

export interface UpdateBookingRequest {
  status?: BookingStatus
  end_date?: string
  actual_items?: number
  special_instructions?: string
  payment_status?: PaymentStatus
}

export interface BookingFilters {
  status?: BookingStatus[]
  service_type?: Booking["service_type"][]
  customer_id?: string
  warehouse_id?: string
  date_range?: {
    from: string
    to: string
  }
  payment_status?: PaymentStatus[]
}

export interface BookingSummary {
  total: number
  by_status: Record<BookingStatus, number>
  by_service_type: Record<Booking["service_type"], number>
  total_revenue: number
}
