"use client"

import useSWR from "swr"
import { bookingService } from "@/modules/booking/services/booking"
import type { BookingFilters } from "@/modules/booking/types"
import type { PaginationParams } from "@/modules/common/types"

export function useBookings(filters?: BookingFilters, pagination?: PaginationParams) {
  const key = ["bookings", JSON.stringify(filters), JSON.stringify(pagination)]

  const { data, error, isLoading, mutate } = useSWR(key, () => bookingService.getBookings(filters, pagination))

  return {
    bookings: data?.data ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useBooking(id: string) {
  const { data, error, isLoading, mutate } = useSWR(id ? ["booking", id] : null, () =>
    bookingService.getBookingById(id),
  )

  return {
    booking: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useBookingSummary(filters?: BookingFilters) {
  const key = ["booking-summary", JSON.stringify(filters)]

  const { data, error, isLoading } = useSWR(key, () => bookingService.getSummary(filters))

  return {
    summary: data,
    isLoading,
    isError: !!error,
    error,
  }
}
