"use client"

import { useMemo } from "react"
import { Calendar as BigCalendar, momentLocalizer, View, Event } from "react-big-calendar"
import moment from "moment"
import "react-big-calendar/lib/css/react-big-calendar.css"
import { cn } from "@/lib/utils"
import type { CalendarEvent, CalendarView as CalendarViewType } from "@/types/calendar"

// Initialize moment localizer
const localizer = momentLocalizer(moment)

// Extend Event type for react-big-calendar
interface RBCEvent extends Event {
  id: string
  title: string
  start: Date
  end: Date
  resource?: {
    originalType: 'booking' | 'task' | 'request' | 'appointment'
    data: any
    filterKeys: string[]
  }
  color?: string
  description?: string
}

interface CalendarViewProps {
  events: CalendarEvent[]
  currentView: CalendarViewType
  currentDate: Date
  onViewChange: (view: CalendarViewType) => void
  onNavigate: (date: Date) => void
  onSelectEvent?: (event: CalendarEvent) => void
}

// Map our view type to react-big-calendar view type
const viewMap: Record<CalendarViewType, View> = {
  month: 'month',
  week: 'week',
  day: 'day',
}

// Event style getter for color coding
const eventStyleGetter = (event: RBCEvent) => {
  const colorMap: Record<string, string> = {
    booking: '#3b82f6', // blue
    task: '#10b981', // green
    'pickup-request': '#f97316', // orange
    'incoming-request': '#22c55e', // green
    'site-visit-request': '#a855f7', // purple
    appointment: '#8b5cf6', // purple/violet for appointments
  }

  // Get type from resource or use event type
  const eventType = event.resource?.originalType === 'booking' 
    ? 'booking' 
    : event.resource?.originalType === 'appointment'
    ? 'appointment'
    : event.resource?.originalType === 'task'
    ? (event.resource.data?.type === 'picking' || event.resource.data?.type === 'shipping'
        ? 'pickup-request'
        : event.resource.data?.type === 'receiving'
        ? 'incoming-request'
        : 'task')
    : 'task'

  const backgroundColor = event.color || colorMap[eventType] || '#6b7280'
  
  return {
    style: {
      backgroundColor,
      color: '#ffffff',
      border: `1px solid ${backgroundColor}`,
      borderRadius: '4px',
      padding: '2px 4px',
      fontSize: '12px',
    },
  }
}

export function CalendarView({
  events,
  currentView,
  currentDate,
  onViewChange,
  onNavigate,
  onSelectEvent,
}: CalendarViewProps) {
  // Transform events to react-big-calendar format
  const rbcEvents = useMemo<RBCEvent[]>(() => {
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      start: new Date(event.start),
      end: new Date(event.end),
      resource: event.resource,
      color: event.color,
      description: event.description,
    }))
  }, [events])

  const handleViewChange = (view: View) => {
    const viewType = Object.keys(viewMap).find(
      (key) => viewMap[key as CalendarViewType] === view
    ) as CalendarViewType
    if (viewType) {
      onViewChange(viewType)
    }
  }

  return (
    <div className="h-full w-full">
      <BigCalendar
        localizer={localizer}
        events={rbcEvents}
        startAccessor="start"
        endAccessor="end"
        view={viewMap[currentView]}
        date={currentDate}
        onView={handleViewChange}
        onNavigate={onNavigate}
        onSelectEvent={(event: RBCEvent) => {
          const originalEvent = events.find(e => e.id === event.id)
          if (originalEvent && onSelectEvent) {
            onSelectEvent(originalEvent)
          }
        }}
        eventPropGetter={eventStyleGetter}
        style={{ height: '100%', minHeight: '600px' }}
        className={cn(
          "rbc-calendar",
          "rbc-calendar-modern"
        )}
        formats={{
          dayFormat: 'ddd D',
          weekdayFormat: 'ddd',
          monthHeaderFormat: 'MMMM YYYY',
          dayHeaderFormat: 'dddd, MMMM D',
          dayRangeHeaderFormat: ({ start, end }) =>
            `${moment(start).format('MMM D')} - ${moment(end).format('MMM D, YYYY')}`,
        }}
        messages={{
          next: 'Next',
          previous: 'Previous',
          today: 'Today',
          month: 'Month',
          week: 'Week',
          day: 'Day',
          agenda: 'Agenda',
          date: 'Date',
          time: 'Time',
          event: 'Event',
          noEventsInRange: 'No events in this range',
        }}
      />
    </div>
  )
}

