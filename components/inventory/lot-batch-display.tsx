'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LotBatchDisplayProps {
  lotNumber?: string | null
  batchNumber?: string | null
  className?: string
}

export function LotBatchDisplay({
  lotNumber,
  batchNumber,
  className,
}: LotBatchDisplayProps) {
  if (!lotNumber && !batchNumber) {
    return null
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {lotNumber && (
        <Badge variant="outline">
          <span className="font-medium">Lot:</span> {lotNumber}
        </Badge>
      )}
      {batchNumber && (
        <Badge variant="outline">
          <span className="font-medium">Batch:</span> {batchNumber}
        </Badge>
      )}
    </div>
  )
}

