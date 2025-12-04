"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Package, Layers, Building2, Loader2 } from "@/components/icons"
import { WAREHOUSE_CONFIG } from "@/lib/constants"
import { formatNumber } from "@/lib/utils/format"

interface InventoryItem {
  id: string
  pallet_id: string
  item_type?: string
  location_code?: string
  status: string
  description?: string
  hall_id?: string
  zone_id?: string
}

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFloor, setSelectedFloor] = useState("1")
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<{
    total: number
    byStatus: Record<string, number>
    byHall: Record<string, number>
  } | null>(null)

  const currentFloor = WAREHOUSE_CONFIG.floors.find((f) => f.floorNumber === Number(selectedFloor))

  useEffect(() => {
    fetchInventoryData()
  }, [selectedFloor, searchQuery])

  const fetchInventoryData = async () => {
    try {
      setLoading(true)
      
      // Fetch inventory items
      const params = new URLSearchParams()
      if (searchQuery) {
        params.append('search', searchQuery)
      }
      // Note: In a real implementation, you'd filter by floor/hall based on selectedFloor
      
      const [itemsResponse, statsResponse] = await Promise.all([
        fetch(`/api/v1/inventory?${params.toString()}`),
        fetch(`/api/v1/inventory?stats=true`),
      ])

      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json()
        setInventoryItems(itemsData.data || [])
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.data)
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error)
    } finally {
      setLoading(false)
    }
  }

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

      {/* Floor Tabs */}
      <Tabs value={selectedFloor} onValueChange={setSelectedFloor}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="1">Level 1</TabsTrigger>
          <TabsTrigger value="2">Level 2</TabsTrigger>
          <TabsTrigger value="3">Level 3</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Floor Overview */}
      {currentFloor && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{currentFloor.name}</CardTitle>
              {currentFloor.floorNumber === 3 && <Badge>Area Rental</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted rounded-lg text-center">
                <Building2 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{formatNumber(currentFloor.totalSqFt)}</p>
                <p className="text-xs text-muted-foreground">Total sq ft</p>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <Layers className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Pallets</p>
              </div>
            </div>

            {/* Halls */}
            {currentFloor.halls.map((hall) => {
              const utilization = Math.round((hall.occupiedSqFt / hall.sqFt) * 100)

              return (
                <div key={hall.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Hall {hall.hallName}</span>
                    <Badge variant={utilization > 80 ? "destructive" : "secondary"}>{utilization}% Used</Badge>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full ${utilization > 80 ? "bg-red-500" : utilization > 50 ? "bg-amber-500" : "bg-green-500"}`}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatNumber(hall.occupiedSqFt)} used</span>
                    <span>{formatNumber(hall.availableSqFt)} available</span>
                  </div>

                  {/* Zones (not for Level 3) */}
                  {currentFloor.floorNumber !== 3 && (
                    <div className="mt-3 space-y-2">
                      {hall.zones.map((zone) => (
                        <div
                          key={zone.id}
                          className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span>{zone.name}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {zone.availableSlots}/{zone.totalSlots}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
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
