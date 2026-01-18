"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Loader2 } from "@/components/icons"
import { CalendarView } from "@/components/calendar/calendar-view"
import { FilterBadges } from "@/components/calendar/filter-badges"
import { ViewSwitcher } from "@/components/calendar/view-switcher"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { bookingToCalendarEvents, taskToCalendarEvents, filterCalendarEvents } from "@/lib/utils/calendar"
import type { Booking, Task } from "@/types"
import type { CalendarEvent, CalendarView as CalendarViewType, CalendarFilter } from "@/types/calendar"

export default function CalendarPage() {
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()
  const [currentView, setCurrentView] = useState<CalendarViewType>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activeFilters, setActiveFilters] = useState<Set<CalendarFilter>>(new Set())

  // Fetch bookings
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings', user?.id],
    queryFn: async () => {
      if (!user) return []
      const result = await api.get<Booking[]>(`/api/v1/bookings?customerId=${user.id}`, { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!user && !userLoading,
  })

  // Fetch tasks
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      if (!user) return []
      const result = await api.get<Task[]>('/api/v1/tasks', { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!user && !userLoading,
  })

  // Transform bookings and tasks to calendar events
  const allEvents = useMemo(() => {
    const bookingEvents = bookings.flatMap(bookingToCalendarEvents)
    const taskEvents = tasks.flatMap(taskToCalendarEvents)
    return [...bookingEvents, ...taskEvents]
  }, [bookings, tasks])

  // Filter events based on active filters
  const filteredEvents = useMemo(() => {
    return filterCalendarEvents(allEvents, activeFilters)
  }, [allEvents, activeFilters])

  const handleFilterToggle = (filter: CalendarFilter) => {
    setActiveFilters((prev) => {
      const newFilters = new Set(prev)
      if (newFilters.has(filter)) {
        newFilters.delete(filter)
      } else {
        newFilters.add(filter)
      }
      return newFilters
    })
  }

  const handleEventSelect = (event: CalendarEvent) => {
    // Navigate to booking or task detail page
    if (event.resource.originalType === 'booking') {
      const booking = event.resource.data as Booking
      router.push(`/dashboard/bookings/${booking.id}`)
    } else if (event.resource.originalType === 'task') {
      // TODO: Navigate to task detail if available
    }
  }

  const isLoading = userLoading || bookingsLoading || tasksLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -m-6">
      <div className="border-b bg-card px-6 py-4">
        <PageHeader 
          title="Calendar" 
          description="View all bookings, tasks, and requests in calendar format"
        />
      </div>
      
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - View Switcher */}
        <ViewSwitcher 
          currentView={currentView} 
          onViewChange={setCurrentView} 
        />

        {/* Main Calendar Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Filter Badges */}
          <FilterBadges 
            activeFilters={activeFilters}
            onFilterToggle={handleFilterToggle}
          />

          {/* Calendar View */}
          <div className="flex-1 p-4 overflow-hidden min-h-0">
            <div className="h-full">
              <CalendarView
                events={filteredEvents}
                currentView={currentView}
                currentDate={currentDate}
                onViewChange={setCurrentView}
                onNavigate={setCurrentDate}
                onSelectEvent={handleEventSelect}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

