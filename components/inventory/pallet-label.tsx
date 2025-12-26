'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrackingNumberDisplay } from './tracking-number-display'
import { LotBatchDisplay } from './lot-batch-display'
import { StorageDurationDisplay } from './storage-duration-display'
import { LocationBreadcrumb } from '@/components/warehouses/location-breadcrumb'
import type { PalletLabelData } from '@/types'
import { cn } from '@/lib/utils'

interface PalletLabelProps {
  labelData: PalletLabelData
  className?: string
  printMode?: boolean
}

export function PalletLabel({
  labelData,
  className,
  printMode = false,
}: PalletLabelProps) {
  return (
    <Card className={cn('w-full', printMode && 'border-2', className)}>
      <CardHeader>
        <CardTitle className="text-center">PALLET LABEL</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Identification Section */}
        <div className="space-y-2 border-b pb-4">
          <div>
            <span className="text-sm text-muted-foreground">Warehouse Tracking:</span>
            <TrackingNumberDisplay
              trackingNumber={labelData.warehouseTrackingNumber}
              className="mt-1"
            />
          </div>
          {labelData.barcode && (
            <div className="text-xs text-muted-foreground">Barcode: {labelData.barcode}</div>
          )}
        </div>

        {/* Customer Information */}
        <div className="space-y-2 border-b pb-4">
          <div>
            <span className="text-sm text-muted-foreground">Customer:</span>
            <div className="font-semibold">{labelData.customerName}</div>
          </div>
          <LotBatchDisplay
            lotNumber={labelData.customerLotNumber}
            batchNumber={labelData.customerBatchNumber}
          />
        </div>

        {/* Dates */}
        <div className="space-y-2 border-b pb-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Arrival Date:</span>
              <div className="font-medium">{labelData.arrivalDate}</div>
            </div>
            {labelData.expectedReleaseDate && (
              <div>
                <span className="text-muted-foreground">Expected Release:</span>
                <div className="font-medium">{labelData.expectedReleaseDate}</div>
              </div>
            )}
          </div>
          <StorageDurationDisplay
            days={labelData.daysInWarehouse}
            months={labelData.monthsInWarehouse}
          />
        </div>

        {/* Stock Information */}
        {(labelData.stockDefinition ||
          labelData.numberOfCases ||
          labelData.hsCode) && (
          <div className="space-y-2 border-b pb-4">
            {labelData.stockDefinition && (
              <div>
                <span className="text-sm text-muted-foreground">Stock Definition:</span>
                <div className="font-medium">{labelData.stockDefinition}</div>
              </div>
            )}
            {(labelData.numberOfCases || labelData.numberOfUnits) && (
              <div className="flex gap-4 text-sm">
                {labelData.numberOfCases && (
                  <div>
                    <span className="text-muted-foreground">Cases:</span>{' '}
                    <span className="font-medium">{labelData.numberOfCases}</span>
                  </div>
                )}
                {labelData.numberOfUnits && (
                  <div>
                    <span className="text-muted-foreground">Units:</span>{' '}
                    <span className="font-medium">
                      {labelData.numberOfUnits} {labelData.unitType || ''}
                    </span>
                  </div>
                )}
              </div>
            )}
            {labelData.hsCode && (
              <div>
                <span className="text-sm text-muted-foreground">HS Code:</span>{' '}
                <span className="font-mono">{labelData.hsCode}</span>
              </div>
            )}
          </div>
        )}

        {/* Location */}
        <div className="space-y-2 border-b pb-4">
          <span className="text-sm text-muted-foreground">Location:</span>
          <LocationBreadcrumb
            floor={labelData.location.floor}
            region={labelData.location.region}
            hall={labelData.location.hall}
            zone={labelData.location.zone}
            locationCode={labelData.location.locationCode}
          />
        </div>

        {/* Storage Requirements */}
        {labelData.storageRequirements &&
          labelData.storageRequirements.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Storage Requirements:</span>
              <ul className="list-disc list-inside space-y-1">
                {labelData.storageRequirements.map((req, index) => (
                  <li key={index} className="text-sm">
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

        {/* Status */}
        <div className="pt-2">
          <Badge variant="outline">Status: {labelData.status}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

