import type { Booking, CreateBookingRequest, UpdateBookingRequest, BookingFilters, BookingSummary } from "../types"
import type { PaginatedResponse, PaginationParams } from "../../common/types"

// Mock data store
const bookings: Booking[] = [
  {
    id: "book-001",
    booking_number: "BK-2024-0001",
    customer_id: "cust-001",
    warehouse_id: "wh-001",
    storage_unit_id: "unit-001",
    service_type: "storage",
    status: "in_progress",
    start_date: "2024-01-15T00:00:00Z",
    end_date: "2024-12-31T23:59:59Z",
    estimated_items: 150,
    actual_items: 142,
    special_instructions: "Handle with care - fragile electronics",
    total_amount: 4200,
    deposit_amount: 840,
    payment_status: "paid",
    created_at: "2024-01-10T14:30:00Z",
    updated_at: "2024-06-01T09:00:00Z",
  },
  {
    id: "book-002",
    booking_number: "BK-2024-0002",
    customer_id: "cust-002",
    warehouse_id: "wh-001",
    service_type: "fulfillment",
    status: "confirmed",
    start_date: "2024-06-15T00:00:00Z",
    estimated_items: 500,
    total_amount: 8500,
    deposit_amount: 1700,
    payment_status: "partial",
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-10T11:00:00Z",
  },
  {
    id: "book-003",
    booking_number: "BK-2024-0003",
    customer_id: "cust-003",
    warehouse_id: "wh-002",
    service_type: "cross_dock",
    status: "pending",
    start_date: "2024-07-01T00:00:00Z",
    end_date: "2024-07-03T23:59:59Z",
    estimated_items: 2000,
    total_amount: 15000,
    deposit_amount: 3000,
    payment_status: "pending",
    created_at: "2024-06-15T08:00:00Z",
    updated_at: "2024-06-15T08:00:00Z",
  },
]

export class BookingService {
  private static instance: BookingService

  static getInstance(): BookingService {
    if (!BookingService.instance) {
      BookingService.instance = new BookingService()
    }
    return BookingService.instance
  }

  async getBookings(filters?: BookingFilters, pagination?: PaginationParams): Promise<PaginatedResponse<Booking>> {
    let filtered = [...bookings]

    // Apply filters
    if (filters?.status?.length) {
      filtered = filtered.filter((b) => filters.status!.includes(b.status))
    }
    if (filters?.service_type?.length) {
      filtered = filtered.filter((b) => filters.service_type!.includes(b.service_type))
    }
    if (filters?.customer_id) {
      filtered = filtered.filter((b) => b.customer_id === filters.customer_id)
    }
    if (filters?.warehouse_id) {
      filtered = filtered.filter((b) => b.warehouse_id === filters.warehouse_id)
    }
    if (filters?.payment_status?.length) {
      filtered = filtered.filter((b) => filters.payment_status!.includes(b.payment_status))
    }

    const page = pagination?.page ?? 1
    const limit = pagination?.limit ?? 10
    const start = (page - 1) * limit
    const end = start + limit

    return {
      data: filtered.slice(start, end),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    }
  }

  async getBookingById(id: string): Promise<Booking | null> {
    return bookings.find((b) => b.id === id) ?? null
  }

  async getBookingByNumber(bookingNumber: string): Promise<Booking | null> {
    return bookings.find((b) => b.booking_number === bookingNumber) ?? null
  }

  async createBooking(data: CreateBookingRequest): Promise<Booking> {
    const newBooking: Booking = {
      id: `book-${Date.now()}`,
      booking_number: `BK-${new Date().getFullYear()}-${String(bookings.length + 1).padStart(4, "0")}`,
      ...data,
      status: "pending",
      payment_status: "pending",
      total_amount: 0,
      deposit_amount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    bookings.push(newBooking)
    return newBooking
  }

  async updateBooking(id: string, data: UpdateBookingRequest): Promise<Booking | null> {
    const index = bookings.findIndex((b) => b.id === id)
    if (index === -1) return null

    bookings[index] = {
      ...bookings[index],
      ...data,
      updated_at: new Date().toISOString(),
    }

    return bookings[index]
  }

  async cancelBooking(id: string, reason?: string): Promise<Booking | null> {
    return this.updateBooking(id, { status: "cancelled" })
  }

  async getSummary(filters?: BookingFilters): Promise<BookingSummary> {
    let filtered = [...bookings]

    if (filters?.warehouse_id) {
      filtered = filtered.filter((b) => b.warehouse_id === filters.warehouse_id)
    }

    const summary: BookingSummary = {
      total: filtered.length,
      by_status: {
        pending: 0,
        confirmed: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
      },
      by_service_type: {
        storage: 0,
        fulfillment: 0,
        cross_dock: 0,
        value_added: 0,
      },
      total_revenue: 0,
    }

    for (const booking of filtered) {
      summary.by_status[booking.status]++
      summary.by_service_type[booking.service_type]++
      summary.total_revenue += booking.total_amount
    }

    return summary
  }
}

export const bookingService = BookingService.getInstance()
