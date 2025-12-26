"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils/format"
import { Package, ClipboardList, Truck, Calendar as CalendarIcon } from "@/components/icons"
import type { CalendarEvent } from "@/types/calendar"
import type { Booking, Task } from "@/types"

interface EventCardProps {
  event: CalendarEvent
  onClose?: () => void
}

export function EventCard({ event }: EventCardProps) {
  const { resource, title, start, end, description } = event
  const { originalType, data } = resource

  const getIcon = () => {
    if (originalType === 'booking') {
      return Package
    }
    if (originalType === 'task') {
      const task = data as Task
      if (task.type === 'picking' || task.type === 'shipping') {
        return Truck
      }
      return ClipboardList
    }
    return CalendarIcon
  }

  const getTypeLabel = () => {
    if (originalType === 'booking') {
      const booking = data as Booking
      return booking.type === 'pallet' ? 'Pallet Booking' : 'Area Rental'
    }
    if (originalType === 'task') {
      const task = data as Task
      if (task.type === 'picking' || task.type === 'shipping') {
        return 'Pick Up Request'
      }
      if (task.type === 'receiving') {
        return 'Incoming Request'
      }
      return 'Task'
    }
    return 'Event'
  }

  const Icon = getIcon()

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Badge variant="outline">{getTypeLabel()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarIcon className="h-4 w-4" />
          <span>
            {formatDateTime(start)}
            {end && ` - ${formatDateTime(end)}`}
          </span>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {originalType === 'booking' && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Booking ID: {(data as Booking).id.slice(0, 8)}
            </p>
          </div>
        )}
        {originalType === 'task' && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Task ID: {(data as Task).id.slice(0, 8)}
            </p>
            {(data as Task).assignedToName && (
              <p className="text-xs text-muted-foreground">
                Assigned to: {(data as Task).assignedToName}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

