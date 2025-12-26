'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StorageDurationDisplayProps {
  days: number
  months: number
  className?: string
}

export function StorageDurationDisplay({
  days,
  months,
  className,
}: StorageDurationDisplayProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge variant="secondary">
        {days} {days === 1 ? 'day' : 'days'}
      </Badge>
      <Badge variant="secondary">
        {months.toFixed(1)} {months === 1 ? 'month' : 'months'}
      </Badge>
    </div>
  )
}

