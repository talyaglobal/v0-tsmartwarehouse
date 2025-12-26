'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LocationBreadcrumbProps {
  floor?: {
    id: string
    floorNumber: number
    name: string
  } | null
  region?: {
    id: string
    name: string
  } | null
  hall?: {
    id: string
    hallName: string
  } | null
  zone?: {
    id: string
    name: string
    type: string
  } | null
  locationCode?: string | null
  className?: string
}

export function LocationBreadcrumb({
  floor,
  region,
  hall,
  zone,
  locationCode,
  className,
}: LocationBreadcrumbProps) {
  const parts: string[] = []

  if (floor) {
    parts.push(`Floor ${floor.floorNumber}`)
  }
  if (region) {
    parts.push(region.name)
  }
  if (hall) {
    parts.push(`Hall ${hall.hallName}`)
  }
  if (zone) {
    parts.push(zone.name)
  }

  if (parts.length === 0 && !locationCode) {
    return <span className="text-muted-foreground">No location assigned</span>
  }

  return (
    <div className={cn('flex items-center gap-1 text-sm', className)}>
      {parts.length > 0 && (
        <>
          {parts.map((part, index) => (
            <span key={index} className="flex items-center gap-1">
              <span>{part}</span>
              {index < parts.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </span>
          ))}
        </>
      )}
      {locationCode && (
        <>
          {parts.length > 0 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="font-mono text-muted-foreground">{locationCode}</span>
        </>
      )}
    </div>
  )
}

