"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Package, Layers, Building2, Loader2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/utils/format"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"

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

interface WarehouseFloor {
  id: string
  warehouseId: string
  floorNumber: number
  name: string
  totalSqFt: number
  halls: WarehouseHall[]
}

interface WarehouseHall {
  id: string
  floorId: string
  hallName: string
  sqFt: number
  availableSqFt: number
  occupiedSqFt: number
  zones: WarehouseZone[]
}

interface WarehouseZone {
  id: string
  hallId: string
  name: string
  type: string
  totalSlots?: number | null
  availableSlots?: number | null
}

export default function InventoryPage() {
  const { user, isLoading: userLoading } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFloor, setSelectedFloor] = useState("1")
  const [warehouseFloors, setWarehouseFloors] = useState<WarehouseFloor[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)

  // Fetch assigned warehouse IDs
  const { data: warehouseIds = [] } = useQuery({
    queryKey: ['warehouse-staff-warehouse-ids', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      // Use the warehouse staff bookings endpoint to get warehouse IDs
      const result = await api.get<any[]>(`/api/v1/warehouse-staff/bookings`, { showToast: false })
      // Extract unique warehouse IDs from bookings
      if (result.success && result.data) {
        const ids = [...new Set(result.data.map((b: any) => b.warehouseId).filter(Boolean))]
        return ids
      }
      return []
    },
    enabled: !!user?.id && !userLoading,
  })

  // Set default warehouse if only one
  useEffect(() => {
    if (warehouseIds && warehouseIds.length > 0 && !selectedWarehouseId) {
      setSelectedWarehouseId(warehouseIds[0])
    }
  }, [warehouseIds, selectedWarehouseId])

  // Fetch inventory items
  const { data: inventoryItems = [], isLoading: itemsLoading } = useQuery<InventoryItem[]>({
    queryKey: ['inventory', 'warehouse-staff', selectedWarehouseId, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (searchQuery) {
        params.append('search', searchQuery)
      }
      if (selectedWarehouseId) {
        params.append('warehouse_id', selectedWarehouseId)
      }
      
      const result = await api.get<InventoryItem[]>(`/api/v1/inventory?${params.toString()}`, { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!selectedWarehouseId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
  })

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['inventory-stats', 'warehouse-staff', selectedWarehouseId],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append('stats', 'true')
      if (selectedWarehouseId) {
        params.append('warehouse_id', selectedWarehouseId)
      }
      
      const result = await api.get(`/api/v1/inventory?${params.toString()}`, { showToast: false })
      return result.success ? result.data : null
    },
    enabled: !!selectedWarehouseId,
    staleTime: 0,
  })

  const loading = userLoading || itemsLoading

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Inventory</h1>

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
      {warehouseIds.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {warehouseIds.map((warehouseId) => (
                <Button
                  key={warehouseId}
                  variant={selectedWarehouseId === warehouseId ? "default" : "outline"}
                  onClick={() => setSelectedWarehouseId(warehouseId)}
                >
                  {warehouseId}
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
