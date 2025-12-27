/**
 * Calendar-related types for unified event display
 */

import type { Booking, Task } from './index'

export type CalendarView = 'month' | 'week' | 'day'

export type CalendarEventType = 
  | 'booking'
  | 'task'
  | 'pickup-request'
  | 'incoming-request'
  | 'site-visit-request'
  | 'appointment'

export type CalendarFilter = 
  | 'new-booking'
  | 'pickup-request'
  | 'incoming-request'
  | 'site-visit-request'
  | 'booking-pending'
  | 'booking-confirmed'
  | 'booking-active'
  | 'booking-completed'
  | 'booking-cancelled'
  | 'booking-pallet'
  | 'booking-area-rental'

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: CalendarEventType
  resource: {
    originalType: 'booking' | 'task' | 'request' | 'appointment'
    data: Booking | Task | import('./index').Appointment | null
    filterKeys: CalendarFilter[]
  }
  color?: string
  description?: string
}

export interface CalendarFilters {
  activeFilters: Set<CalendarFilter>
}

