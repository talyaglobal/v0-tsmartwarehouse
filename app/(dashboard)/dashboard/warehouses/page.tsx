"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Input } from "@/components/ui/input"
import { Building2, MapPin, Package, Search, Loader2, Plus, ArrowRight, Grid, List } from "@/components/icons"
import { api } from "@/lib/api/client"
import { formatNumber } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { Warehouse } from "@/types"

type ViewMode = "grid" | "list"

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

  useEffect(() => {
    fetchWarehouses()
  }, [])

  async function fetchWarehouses() {
    try {
      setLoading(true)
      const result = await api.get<Warehouse[]>("/api/v1/warehouses", { showToast: false })
      if (result.success) {
        setWarehouses(result.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch warehouses:", error)
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description="View and manage warehouse facilities"
      >
        <Link href="/dashboard/warehouses/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Warehouse
          </Button>
        </Link>
      </PageHeader>

      {/* Search and View Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search warehouses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "h-8 px-3",
                  viewMode === "grid" && "bg-primary text-primary-foreground"
                )}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={cn(
                  "h-8 px-3",
                  viewMode === "list" && "bg-primary text-primary-foreground"
                )}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warehouse List/Grid */}
      {filteredWarehouses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg mb-2">No warehouses found</p>
            <p className="text-muted-foreground text-sm">
              {searchTerm ? "Try adjusting your search" : "Get started by creating a new warehouse"}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredWarehouses.map((warehouse) => (
            <Card key={warehouse.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{warehouse.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {warehouse.city}, {warehouse.zipCode}
                    </CardDescription>
                  </div>
                  <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Capacity:</span>
                    <span className="font-medium">{formatNumber(warehouse.totalSqFt)} sq ft</span>
                  </div>
                  {warehouse.totalPalletStorage && (
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Pallet Storage:</span>
                      <span className="font-medium">{formatNumber(warehouse.totalPalletStorage)} pallets</span>
                    </div>
                  )}
                  {warehouse.address && (
                    <div className="text-sm text-muted-foreground pt-2 border-t">
                      {warehouse.address}
                    </div>
                  )}
                  <div className="pt-2 flex gap-2">
                    <Link href={`/dashboard/warehouses/${warehouse.id}/capacity`} className="flex-1">
                      <Button variant="outline" className="w-full">
                        View Details
                      </Button>
                    </Link>
                    <Link href={`/warehouses/${warehouse.id}/book`} className="flex-1">
                      <Button className="w-full">
                        Book Space
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWarehouses.map((warehouse) => (
            <Card key={warehouse.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{warehouse.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {warehouse.city}, {warehouse.zipCode}
                        </CardDescription>
                        {warehouse.address && (
                          <p className="text-sm text-muted-foreground mt-1">{warehouse.address}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 mt-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Capacity:</span>
                        <span className="font-medium">{formatNumber(warehouse.totalSqFt)} sq ft</span>
                      </div>
                      {warehouse.totalPalletStorage && (
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Pallet Storage:</span>
                          <span className="font-medium">{formatNumber(warehouse.totalPalletStorage)} pallets</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Link href={`/dashboard/warehouses/${warehouse.id}/capacity`}>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </Link>
                      <Link href={`/warehouses/${warehouse.id}/book`}>
                        <Button size="sm">
                          Book Space
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

