"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Package, Layers, Building2, Loader2, Calendar } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { useRouter } from "next/navigation"

interface InventoryItem {
  id: string
  pallet_id: string
  item_type?: string
  location_code?: string
  status: string
  description?: string
  hall_id?: string
  zone_id?: string
  warehouse_id?: string
}



import type { Booking } from "@/types"

export default function InventoryPage() {
  const { user, isLoading: userLoading } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
  const router = useRouter()

  interface WarehouseAssignment {
    warehouseId: string
    warehouseName: string
    warehouseCity?: string
    role: "manager" | "staff"
    assignedAt: string
  }

  const [selectedCity, setSelectedCity] = useState<string>("all")

  // Fetch assigned warehouses with names
  const { data: warehouses = [] } = useQuery<WarehouseAssignment[]>({
    queryKey: ['warehouse-staff-warehouses', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      // Use the warehouse staff warehouses endpoint to get assigned warehouses
      const result = await api.get<WarehouseAssignment[]>(`/api/v1/warehouse-staff/warehouses`, { showToast: false })
      if (result.success && result.data) {
        return result.data
      }
      return []
    },
    enabled: !!user?.id && !userLoading,
  })

  const warehouseIds = warehouses.map(w => w.warehouseId)

  // Set default warehouse if only one
  useEffect(() => {
    if (warehouseIds && warehouseIds.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouseIds[0])
    }
  }, [warehouseIds, selectedWarehouseId])

  // Fetch inventory items
  const { data: inventoryItems = [], isLoading: itemsLoading } = useQuery<InventoryItem[]>({
    queryKey: ['inventory', 'warehouse-staff', selectedWarehouseId, searchQuery, warehouseIds],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchQuery) {
        params.append('search', searchQuery)
      }
      // If warehouse is selected, use it; otherwise API will fetch for all assigned warehouses
      if (selectedWarehouseId) {
        params.append('warehouse_id', selectedWarehouseId)
      }
      
      const result = await api.get<InventoryItem[]>(`/api/v1/inventory?${params.toString()}`, { showToast: false })
      if (!result.success) {
        console.error('Failed to fetch inventory items:', result.error)
        return []
      }
      const items = result.data || []
      console.log('Fetched inventory items:', items.length, 'for warehouse:', selectedWarehouseId || 'all assigned')
      return items
    },
    enabled: warehouseIds.length > 0, // Enable when we have warehouse IDs (even if no specific warehouse selected)
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['inventory-stats', 'warehouse-staff', selectedWarehouseId, warehouseIds],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('stats', 'true')
      if (selectedWarehouseId) {
        params.append('warehouse_id', selectedWarehouseId)
      }
      
      const result = await api.get(`/api/v1/inventory?${params.toString()}`, { showToast: false })
      return result.success ? result.data : null
    },
    enabled: warehouseIds.length > 0, // Enable when we have warehouse IDs
    staleTime: 0,
  })

  // Fetch bookings for assigned warehouses
  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ['warehouse-staff-bookings', user?.id, selectedWarehouseId],
    queryFn: async () => {
      if (!user?.id) return []
      const result = await api.get<Booking[]>(`/api/v1/warehouse-staff/bookings`, { showToast: false })
      if (!result.success) {
        console.error('Failed to fetch bookings:', result.error)
        return []
      }
      // Filter by selected warehouse if one is selected
      let bookings = result.data || []
      if (selectedWarehouseId) {
        bookings = bookings.filter(b => b.warehouseId === selectedWarehouseId)
      }
      // Sort by start date
      return bookings.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    },
    enabled: !!user?.id && !userLoading && !!selectedWarehouseId,
    staleTime: 0,
    refetchOnMount: true,
  })


  const loading = userLoading || itemsLoading

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (warehouseIds.length === 0) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold">Inventory</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>You are not assigned to any warehouses.</p>
              <p className="text-sm mt-2">Please contact your administrator to be assigned to a warehouse.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Inventory</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search pallets, locations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Warehouse Selector (if multiple warehouses) */}
      {warehouses.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Warehouse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* City Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by City</label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="w-full sm:w-[250px]">
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {Array.from(new Set(warehouses.map(w => w.warehouseCity).filter(Boolean))).map((city) => (
                    <SelectItem key={city} value={city || ""}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse Buttons */}
            <div className="flex gap-2 flex-wrap">
              {warehouses
                .filter((warehouse) => selectedCity === "all" || warehouse.warehouseCity === selectedCity)
                .map((warehouse) => (
                  <Button
                    key={warehouse.warehouseId}
                    variant={selectedWarehouseId === warehouse.warehouseId ? "default" : "outline"}
                    onClick={() => setSelectedWarehouseId(warehouse.warehouseId)}
                  >
                    {warehouse.warehouseName}
                    {warehouse.warehouseCity && (
                      <span className="ml-2 text-xs opacity-70">({warehouse.warehouseCity})</span>
                    )}
                  </Button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Summary */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted rounded-lg text-center">
                <Layers className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{stats.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Items</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <Package className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">
                  {stats.byStatus?.['stored'] || stats.byStatus?.['received'] || 0}
                </p>
                <p className="text-xs text-muted-foreground">Stored Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bookings List */}
      {selectedWarehouseId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No bookings found for this warehouse</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{booking.customerName}</p>
                          <p className="text-sm text-muted-foreground">{booking.customerEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {booking.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(booking.startDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </TableCell>
                      <TableCell>
                        {booking.endDate
                          ? new Date(booking.endDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : 'Ongoing'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {booking.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/warehouse/bookings/${booking.id}`)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Inventory Items List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : inventoryItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No inventory items found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pallet ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-medium">{item.pallet_id}</TableCell>
                    <TableCell>{item.item_type || 'General'}</TableCell>
                    <TableCell>{item.location_code || 'Not assigned'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.description || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
