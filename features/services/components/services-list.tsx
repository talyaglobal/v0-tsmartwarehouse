'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Wrench, DollarSign, Plus, Grid, List, FileText } from '@/components/icons'
import Link from 'next/link'
import { exportServicesToPDF } from '@/lib/utils/services-export'
import type { WarehouseService, ServiceCategory } from '@/types'

interface ServicesListProps {
  services: WarehouseService[]
}

const categoryLabels: Record<ServiceCategory, string> = {
  receiving: 'Receiving',
  putaway: 'Putaway',
  picking: 'Picking',
  shipping: 'Shipping',
  repalletization: 'Repalletization',
  labeling: 'Labeling',
  inventory: 'Inventory',
  'cross-docking': 'Cross-Docking',
  kitting: 'Kitting',
  returns: 'Returns',
  'quality-control': 'Quality Control',
  'temperature-control': 'Temperature Control',
  hazmat: 'Hazmat',
  'custom-packaging': 'Custom Packaging',
  other: 'Other',
}

const unitTypeLabels: Record<string, string> = {
  'per-item': 'per item',
  'per-pallet': 'per pallet',
  'per-hour': 'per hour',
  'per-order': 'per order',
  'flat-rate': 'flat rate',
}

type ViewMode = 'grid' | 'list'

export function ServicesList({ services }: ServicesListProps) {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const categories: ServiceCategory[] = [
    'receiving',
    'putaway',
    'picking',
    'shipping',
    'repalletization',
    'labeling',
    'inventory',
    'kitting',
    'returns',
    'quality-control',
  ]

  const filteredServices =
    selectedCategory === 'all'
      ? services
      : services.filter((service) => service.category === selectedCategory)

  const handleExportPDF = () => {
    exportServicesToPDF(services)
  }

  return (
    <div className="space-y-6">
      {/* Category Filter, View Switcher, and Export Buttons */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
            >
              All Services
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {categoryLabels[category]}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-2 border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="gap-2"
              >
                <Grid className="h-4 w-4" />
                Grid
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="gap-2"
              >
                <List className="h-4 w-4" />
                List
              </Button>
            </div>

            {/* Export Button */}
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Print Price List PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Services Display */}
      {filteredServices.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No services found</p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => (
            <Card key={service.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                  </div>
                  <Badge variant="secondary">{categoryLabels[service.category]}</Badge>
                </div>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {unitTypeLabels[service.unitType]}
                    </p>
                    <p className="text-2xl font-bold flex items-center gap-1">
                      <DollarSign className="h-5 w-5" />
                      {service.basePrice.toFixed(2)}
                    </p>
                  </div>
                  <Link href={`/dashboard/orders/new?serviceId=${service.id}`}>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add to Order
                    </Button>
                  </Link>
                </div>
                {service.minQuantity > 1 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Minimum quantity: {service.minQuantity}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit Type</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Min Quantity</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Wrench className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{service.name}</p>
                        {service.description && (
                          <p className="text-sm text-muted-foreground">{service.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{categoryLabels[service.category]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {unitTypeLabels[service.unitType]}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-4 w-4" />
                      {service.basePrice.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>{service.minQuantity > 1 ? service.minQuantity : '-'}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/orders/new?serviceId=${service.id}`}>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Add to Order
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

