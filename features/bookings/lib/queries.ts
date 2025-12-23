/**
 * Booking queries for Server Components
 * Direct database access without API routes
 */

import { cache } from 'react'
import { getBookings } from '@/lib/db/bookings'
import type { BookingFilters } from '../types'

/**
 * Get bookings with caching
 * Use this in Server Components
 */
export const getBookingsQuery = cache(async (filters: BookingFilters = {}) => {
  return await getBookings(filters)
})

/**
 * Get a single booking by ID
 */
export const getBookingById = cache(async (id: string) => {
  const bookings = await getBookings({})
  return bookings.find((b) => b.id === id) || null
})

