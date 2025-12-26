'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wrench, DollarSign, Plus } from '@/components/icons'
import Link from 'next/link'
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

export function ServicesList({ services }: ServicesListProps) {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all')

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

  return (
    <div className="space-y-6">
      {/* Category Filter */}
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

      {/* Services Grid */}
      {filteredServices.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No services found</p>
          </CardContent>
        </Card>
      ) : (
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
      )}
    </div>
  )
}

