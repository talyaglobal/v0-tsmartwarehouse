/**
 * Booking-related types
 */

import type { Booking, BookingStatus, BookingType } from '@/types'

export type { Booking, BookingStatus, BookingType }

export interface BookingFilters {
  customerId?: string
  status?: BookingStatus
  type?: BookingType
  warehouseId?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export interface BookingCreateInput {
  type: BookingType
  palletCount?: number
  areaSqFt?: number
  floorNumber?: number
  hallId?: string
  startDate: string
  endDate?: string
  notes?: string
  warehouseId?: string
}

export interface BookingUpdateInput {
  status?: BookingStatus
  palletCount?: number
  areaSqFt?: number
  startDate?: string
  endDate?: string
  notes?: string
}

