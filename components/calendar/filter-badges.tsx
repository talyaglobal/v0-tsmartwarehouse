"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CalendarFilter } from "@/types/calendar"

interface FilterBadgesProps {
  activeFilters: Set<CalendarFilter>
  onFilterToggle: (filter: CalendarFilter) => void
}

const filterConfig: Record<CalendarFilter, { label: string; color: string }> = {
  'new-booking': { label: 'New Booking', color: 'bg-blue-500' },
  'pickup-request': { label: 'Pick Up Request', color: 'bg-orange-500' },
  'incoming-request': { label: 'Incoming Request', color: 'bg-green-500' },
  'site-visit-request': { label: 'Site Visit Request', color: 'bg-purple-500' },
  'booking-pending': { label: 'Pending', color: 'bg-yellow-500' },
  'booking-confirmed': { label: 'Confirmed', color: 'bg-blue-500' },
  'booking-active': { label: 'Active', color: 'bg-green-500' },
  'booking-completed': { label: 'Completed', color: 'bg-gray-500' },
  'booking-cancelled': { label: 'Cancelled', color: 'bg-red-500' },
  'booking-pallet': { label: 'Pallet', color: 'bg-indigo-500' },
  'booking-area-rental': { label: 'Area Rental', color: 'bg-teal-500' },
}

export function FilterBadges({ activeFilters, onFilterToggle }: FilterBadgesProps) {
  const primaryFilters: CalendarFilter[] = [
    'new-booking',
    'pickup-request',
    'incoming-request',
    'site-visit-request',
  ]

  const statusFilters: CalendarFilter[] = [
    'booking-pending',
    'booking-confirmed',
    'booking-active',
    'booking-completed',
    'booking-cancelled',
  ]

  const typeFilters: CalendarFilter[] = [
    'booking-pallet',
    'booking-area-rental',
  ]

  return (
    <div className="space-y-4 p-4 border-b bg-card">
      {/* Primary Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground mr-2">Filters:</span>
        {primaryFilters.map((filter) => {
          const isActive = activeFilters.has(filter)
          const config = filterConfig[filter]
          return (
            <Badge
              key={filter}
              variant={isActive ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                isActive && config.color
              )}
              onClick={() => onFilterToggle(filter)}
            >
              {config.label}
            </Badge>
          )
        })}
      </div>

      {/* Status & Type Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {statusFilters.map((filter) => {
          const isActive = activeFilters.has(filter)
          const config = filterConfig[filter]
          return (
            <Badge
              key={filter}
              variant={isActive ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors text-xs",
                isActive && config.color
              )}
              onClick={() => onFilterToggle(filter)}
            >
              {config.label}
            </Badge>
          )
        })}
        {typeFilters.map((filter) => {
          const isActive = activeFilters.has(filter)
          const config = filterConfig[filter]
          return (
            <Badge
              key={filter}
              variant={isActive ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors text-xs",
                isActive && config.color
              )}
              onClick={() => onFilterToggle(filter)}
            >
              {config.label}
            </Badge>
          )
        })}
      </div>
    </div>
  )
}

