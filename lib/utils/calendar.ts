/**
 * Calendar utility functions for transforming data to calendar events
 */

import { addDays, differenceInDays, parseISO } from 'date-fns'
import type { Booking, Task } from '@/types'
import type { CalendarEvent, CalendarFilter } from '@/types/calendar'

/**
 * Transform a booking to calendar events
 */
export function bookingToCalendarEvents(booking: Booking): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const startDate = parseISO(booking.startDate)
  const endDate = booking.endDate ? parseISO(booking.endDate) : addDays(startDate, 30)

  // Determine filter keys
  const filterKeys: CalendarFilter[] = []
  
  // Status filters
  if (booking.status === 'pending') filterKeys.push('booking-pending')
  if (booking.status === 'confirmed') filterKeys.push('booking-confirmed')
  if (booking.status === 'active') filterKeys.push('booking-active')
  if (booking.status === 'completed') filterKeys.push('booking-completed')
  if (booking.status === 'cancelled') filterKeys.push('booking-cancelled')
  
  // Type filters
  if (booking.type === 'pallet') filterKeys.push('booking-pallet')
  if (booking.type === 'area-rental') filterKeys.push('booking-area-rental')
  
  // New booking filter (pending or created in last 7 days)
  const createdAt = parseISO(booking.createdAt)
  const daysSinceCreation = differenceInDays(new Date(), createdAt)
  if (booking.status === 'pending' || daysSinceCreation <= 7) {
    filterKeys.push('new-booking')
  }

  const event: CalendarEvent = {
    id: `booking-${booking.id}`,
    title: `${booking.type === 'pallet' ? `${booking.palletCount} Pallets` : `${booking.areaSqFt} sq ft`} - ${booking.customerName}`,
    start: startDate,
    end: endDate,
    type: 'booking',
    resource: {
      originalType: 'booking',
      data: booking,
      filterKeys,
    },
    color: '#3b82f6',
    description: booking.notes || `Booking ${booking.id.slice(0, 8)}`,
  }

  events.push(event)
  return events
}

/**
 * Transform a task to calendar events
 */
export function taskToCalendarEvents(task: Task): CalendarEvent[] {
  const events: CalendarEvent[] = []
  
  if (!task.dueDate) {
    return events
  }

  const dueDate = parseISO(task.dueDate)
  const endDate = addDays(dueDate, 1) // Tasks are single-day events

  // Determine filter keys
  const filterKeys: CalendarFilter[] = []
  
  // Map task types to request filters
  if (task.type === 'picking' || task.type === 'shipping') {
    filterKeys.push('pickup-request')
  }
  if (task.type === 'receiving') {
    filterKeys.push('incoming-request')
  }

  const event: CalendarEvent = {
    id: `task-${task.id}`,
    title: task.title,
    start: dueDate,
    end: endDate,
    type: task.type === 'picking' || task.type === 'shipping' 
      ? 'pickup-request'
      : task.type === 'receiving'
      ? 'incoming-request'
      : 'task',
    resource: {
      originalType: 'task',
      data: task,
      filterKeys,
    },
    color: task.type === 'picking' || task.type === 'shipping' 
      ? '#f97316'
      : task.type === 'receiving'
      ? '#22c55e'
      : '#10b981',
    description: task.description,
  }

  events.push(event)
  return events
}

/**
 * Filter calendar events based on active filters
 */
export function filterCalendarEvents(
  events: CalendarEvent[],
  activeFilters: Set<CalendarFilter>
): CalendarEvent[] {
  if (activeFilters.size === 0) {
    return events
  }

  return events.filter((event) => {
    // Check if any of the event's filter keys match active filters
    return event.resource.filterKeys.some((key) => activeFilters.has(key))
  })
}

