'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Building2, MapPin, Package, Search } from '@/components/icons'
import { api } from '@/lib/api/client'
import type { Warehouse } from '@/types'
import { formatNumber } from '@/lib/utils/format'

export default function WarehouseMarketplacePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchWarehouses()
  }, [])

  async function fetchWarehouses() {
    try {
      setLoading(true)
      const result = await api.get('/api/v1/warehouses', { showToast: false })
      if (result.success) {
        setWarehouses(result.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredWarehouses = warehouses.filter((w) => {
    if (searchTerm && !w.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground">Loading warehouses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Marketplace"
        description="Find and rent warehouse space"
      />

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search warehouses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warehouse Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredWarehouses.map((warehouse) => (
          <Card key={warehouse.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{warehouse.name}</CardTitle>
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {warehouse.city}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  <span>{formatNumber(warehouse.totalSqFt)} sq ft</span>
                </div>
                <div className="pt-2 border-t">
                  <Link href={`/warehouses/${warehouse.id}/book`}>
                    <Button className="w-full">View Details & Book</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

