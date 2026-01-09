"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MapPin, Search, Loader2, Building2 } from "@/components/icons"
import { api } from "@/lib/api/client"
import type { WarehouseDiscoveryResult } from "@/types"

export default function WarehouseFinderMapPage() {
  const [warehouses, setWarehouses] = useState<WarehouseDiscoveryResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchWarehouses()
  }, [])

  const fetchWarehouses = async () => {
    try {
      setLoading(true)
      const result = await api.get<WarehouseDiscoveryResult[]>("/api/v1/crm/warehouse-discovery")
      if (result.success) {
        setWarehouses(result.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch warehouses:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredWarehouses = warehouses.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.city.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouse Discovery Map</h1>
          <p className="text-muted-foreground">
            Discover and explore warehouses in your area
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search warehouses by name, address, or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Badge variant="outline">
              {filteredWarehouses.length} warehouses found
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filteredWarehouses.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No warehouses found</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredWarehouses.map((warehouse) => (
                <Card key={warehouse.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                          <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{warehouse.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {warehouse.address}, {warehouse.city}
                          </CardDescription>
                        </div>
                      </div>
                      {warehouse.inCrm && (
                        <Badge variant="secondary" className="text-xs">In CRM</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Size:</span>
                        <span className="font-medium">{warehouse.totalSqFt.toLocaleString()} sq ft</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Distance:</span>
                        <span className="font-medium">{warehouse.distanceKm.toFixed(1)} km</span>
                      </div>
                    </div>
                    <Button className="w-full mt-4" variant="outline">
                      <MapPin className="h-4 w-4 mr-2" />
                      View on Map
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
