'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrackingNumberDisplay } from '@/components/inventory/tracking-number-display'
import { LotBatchDisplay } from '@/components/inventory/lot-batch-display'
import { LocationBreadcrumb } from '@/components/warehouses/location-breadcrumb'
import { api } from '@/lib/api/client'
import { Search, Loader2 } from 'lucide-react'
import type { InventoryItem } from '@/lib/db/inventory'

export default function InventoryTrackingPage() {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [searchType, setSearchType] = useState<'tracking' | 'lot' | 'batch'>('tracking')

  const [searchTrigger, setSearchTrigger] = useState(0)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory-tracking', trackingNumber, lotNumber, batchNumber, searchType, searchTrigger],
    queryFn: async () => {
      let url = '/api/v1/inventory/tracking?'
      if (searchType === 'tracking' && trackingNumber) {
        url += `tracking_number=${encodeURIComponent(trackingNumber)}`
      } else if (searchType === 'lot' && lotNumber) {
        url += `lot_number=${encodeURIComponent(lotNumber)}`
      } else if (searchType === 'batch' && batchNumber) {
        url += `batch_number=${encodeURIComponent(batchNumber)}`
      } else {
        return []
      }

      const result = await api.get<InventoryItem[]>(url, { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: searchTrigger > 0 && (
      (searchType === 'tracking' && !!trackingNumber) ||
      (searchType === 'lot' && !!lotNumber) ||
      (searchType === 'batch' && !!batchNumber)
    ),
  })

  const handleSearch = () => {
    setSearchTrigger((prev) => prev + 1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Tracking"
        description="Search inventory by warehouse tracking number, customer lot, or batch number"
      />

      <Card>
        <CardHeader>
          <CardTitle>Search Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant={searchType === 'tracking' ? 'default' : 'outline'}
              onClick={() => setSearchType('tracking')}
            >
              Tracking Number
            </Button>
            <Button
              variant={searchType === 'lot' ? 'default' : 'outline'}
              onClick={() => setSearchType('lot')}
            >
              Lot Number
            </Button>
            <Button
              variant={searchType === 'batch' ? 'default' : 'outline'}
              onClick={() => setSearchType('batch')}
            >
              Batch Number
            </Button>
          </div>

          <div className="flex gap-2">
            {searchType === 'tracking' && (
              <Input
                placeholder="Enter warehouse tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && trackingNumber) {
                    handleSearch()
                  }
                }}
              />
            )}
            {searchType === 'lot' && (
              <Input
                placeholder="Enter customer lot number"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && lotNumber) {
                    handleSearch()
                  }
                }}
              />
            )}
            {searchType === 'batch' && (
              <Input
                placeholder="Enter customer batch number"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && batchNumber) {
                    handleSearch()
                  }
                }}
              />
            )}
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking Number</TableHead>
                  <TableHead>Pallet ID</TableHead>
                  <TableHead>Customer Lot/Batch</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.warehouse_tracking_number && (
                        <TrackingNumberDisplay
                          trackingNumber={item.warehouse_tracking_number}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{item.pallet_id}</TableCell>
                    <TableCell>
                      <LotBatchDisplay
                        lotNumber={item.customer_lot_number}
                        batchNumber={item.customer_batch_number}
                      />
                    </TableCell>
                    <TableCell>
                      <LocationBreadcrumb
                        locationCode={item.location_code}
                      />
                    </TableCell>
                    <TableCell>{item.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

