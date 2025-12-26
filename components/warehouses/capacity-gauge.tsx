'use client'

import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface CapacityGaugeProps {
  percentage: number
  totalCapacity: number
  usedCapacity: number
  className?: string
  showDetails?: boolean
}

export function CapacityGauge({
  percentage,
  totalCapacity,
  usedCapacity,
  className,
  showDetails = true,
}: CapacityGaugeProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {showDetails && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {usedCapacity.toLocaleString()} / {totalCapacity.toLocaleString()}
          </span>
          <span className="font-semibold">{percentage.toFixed(1)}%</span>
        </div>
      )}
      <Progress value={percentage} className="h-2" />
      {showDetails && (
        <div className="text-xs text-muted-foreground">
          {totalCapacity - usedCapacity} available
        </div>
      )}
    </div>
  )
}

