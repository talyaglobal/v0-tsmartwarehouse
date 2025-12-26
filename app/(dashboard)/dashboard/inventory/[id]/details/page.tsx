'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { TrackingNumberDisplay } from '@/components/inventory/tracking-number-display'
import { LotBatchDisplay } from '@/components/inventory/lot-batch-display'
import { StorageDurationDisplay } from '@/components/inventory/storage-duration-display'
import { LocationBreadcrumb } from '@/components/warehouses/location-breadcrumb'
import { api } from '@/lib/api/client'
import { Loader2, ArrowLeft, Tag, Package, MapPin, Calendar, FileText, Printer } from 'lucide-react'
import Link from 'next/link'
import type { InventoryItem } from '@/lib/db/inventory'

export default function InventoryDetailsPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolvedParams = use(Promise.resolve(params))
  const inventoryItemId = resolvedParams.id
  const router = useRouter()

  const { data: item, isLoading } = useQuery({
    queryKey: ['inventory-item', inventoryItemId],
    queryFn: async () => {
      const result = await api.get<InventoryItem>(
        `/api/v1/inventory/${inventoryItemId}`,
        { showToast: false }
      )
      if (!result.success || !result.data) {
        throw new Error('Failed to load inventory item')
      }
      return result.data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inventory Item Details" />
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Inventory item not found
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={`Inventory Item: ${item.pallet_id}`}
          description="View detailed information about this inventory item"
        />
        <div className="ml-auto flex gap-2">
          <Link href={`/dashboard/inventory/${item.id}/label`}>
            <Button variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              View Label
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Identification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Identification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Pallet ID</span>
              <span className="font-mono font-medium">{item.pallet_id}</span>
            </div>
            {item.warehouse_tracking_number && (
              <div>
                <span className="text-sm text-muted-foreground block mb-2">
                  Warehouse Tracking Number
                </span>
                <TrackingNumberDisplay trackingNumber={item.warehouse_tracking_number} />
              </div>
            )}
            {item.barcode && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Barcode</span>
                <span className="font-mono text-sm">{item.barcode}</span>
              </div>
            )}
            {item.qr_code && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">QR Code</span>
                <span className="font-mono text-sm">{item.qr_code}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="secondary" className="capitalize">
                {item.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Customer Lot/Batch Information */}
        {(item.customer_lot_number || item.customer_batch_number) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Customer Lot/Batch
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LotBatchDisplay
                lotNumber={item.customer_lot_number}
                batchNumber={item.customer_batch_number}
              />
            </CardContent>
          </Card>
        )}

        {/* Storage Duration */}
        {(item.days_in_warehouse || item.months_in_warehouse) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Storage Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StorageDurationDisplay
                days={item.days_in_warehouse || 0}
                months={item.months_in_warehouse || 0}
              />
              {item.received_date && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Arrival Date</span>
                    <span className="font-medium">{item.received_date}</span>
                  </div>
                  {item.expected_release_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Expected Release</span>
                      <span className="font-medium">{item.expected_release_date}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LocationBreadcrumb
              locationCode={item.location_code}
            />
            {item.location_code && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Location Code</span>
                <span className="font-mono">{item.location_code}</span>
              </div>
            )}
            {item.row_number && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Row</span>
                <span className="font-medium">{item.row_number}</span>
              </div>
            )}
            {item.level_number && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Level</span>
                <span className="font-medium">{item.level_number}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock Information */}
        {(item.stock_definition ||
          item.number_of_cases ||
          item.number_of_units ||
          item.hs_code ||
          item.storage_requirements) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Stock Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {item.stock_definition && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">
                    Stock Definition
                  </span>
                  <p className="font-medium">{item.stock_definition}</p>
                </div>
              )}
              {(item.number_of_cases || item.number_of_units) && (
                <div className="flex gap-6">
                  {item.number_of_cases && (
                    <div>
                      <span className="text-sm text-muted-foreground">Cases</span>
                      <div className="font-medium">{item.number_of_cases}</div>
                    </div>
                  )}
                  {item.number_of_units && (
                    <div>
                      <span className="text-sm text-muted-foreground">Units</span>
                      <div className="font-medium">
                        {item.number_of_units} {item.unit_type || ''}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {item.hs_code && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">HS Code</span>
                  <span className="font-mono">{item.hs_code}</span>
                </div>
              )}
              {item.storage_requirements && item.storage_requirements.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-2">
                    Storage Requirements
                  </span>
                  <ul className="list-disc list-inside space-y-1">
                    {item.storage_requirements.map((req, index) => (
                      <li key={index} className="text-sm">
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {item.description && (
              <div>
                <span className="text-sm text-muted-foreground block mb-1">Description</span>
                <p className="text-sm">{item.description}</p>
              </div>
            )}
            {item.item_type && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Item Type</span>
                <span className="text-sm font-medium">{item.item_type}</span>
              </div>
            )}
            {item.weight_kg && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Weight</span>
                <span className="text-sm font-medium">{item.weight_kg} kg</span>
              </div>
            )}
            {item.notes && (
              <div>
                <span className="text-sm text-muted-foreground block mb-1">Notes</span>
                <p className="text-sm whitespace-pre-wrap">{item.notes}</p>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Updated</span>
              <span>{new Date(item.updated_at).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

