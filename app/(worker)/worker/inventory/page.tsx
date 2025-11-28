"use client"

import * as React from "react"
import { WorkerHeader } from "@/components/worker/worker-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { mockStorageUnits } from "@/lib/mock-data"
import { Search, Filter, Package, MapPin, ThermometerSnowflake } from "lucide-react"

// Mock inventory items
const inventoryItems = [
  {
    id: "1",
    sku: "SKU-001",
    name: "Electronic Components Box A",
    location: "A-101",
    zone: "A",
    quantity: 150,
    status: "in_stock",
  },
  {
    id: "2",
    sku: "SKU-002",
    name: "Office Supplies Package",
    location: "A-102",
    zone: "A",
    quantity: 45,
    status: "low_stock",
  },
  {
    id: "3",
    sku: "SKU-003",
    name: "Marketing Materials",
    location: "B-201",
    zone: "B",
    quantity: 200,
    status: "in_stock",
  },
  {
    id: "4",
    sku: "SKU-004",
    name: "Fragile Glassware Set",
    location: "C-105",
    zone: "C",
    quantity: 12,
    status: "low_stock",
  },
]

export default function InventoryPage() {
  const [search, setSearch] = React.useState("")
  const [zoneFilter, setZoneFilter] = React.useState("all")

  const filteredItems = inventoryItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase())
    const matchesZone = zoneFilter === "all" || item.zone === zoneFilter
    return matchesSearch && matchesZone
  })

  return (
    <div className="flex flex-col min-h-screen">
      <WorkerHeader title="Inventory" />

      <main className="flex-1 p-4 space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search SKU or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-24">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="A">Zone A</SelectItem>
              <SelectItem value="B">Zone B</SelectItem>
              <SelectItem value="C">Zone C</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Zone Summary */}
        <div className="grid grid-cols-3 gap-2">
          {["A", "B", "C"].map((zone) => {
            const zoneItems = inventoryItems.filter((i) => i.zone === zone)
            const totalQty = zoneItems.reduce((acc, i) => acc + i.quantity, 0)
            return (
              <Card key={zone}>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold">Zone {zone}</p>
                  <p className="text-xs text-muted-foreground">
                    {zoneItems.length} items • {totalQty} units
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Inventory List */}
        <div className="space-y-3">
          <h2 className="font-semibold">Items ({filteredItems.length})</h2>
          {filteredItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                      <p className="font-medium">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{item.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{item.quantity}</p>
                    <span className={`text-xs ${item.status === "low_stock" ? "text-amber-600" : "text-emerald-600"}`}>
                      {item.status === "low_stock" ? "Low Stock" : "In Stock"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Storage Units */}
        <div className="space-y-3">
          <h2 className="font-semibold">Storage Units</h2>
          {mockStorageUnits.slice(0, 3).map((unit) => (
            <Card key={unit.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{unit.unit_number}</p>
                    <p className="text-xs text-muted-foreground">
                      Zone {unit.zone} • Aisle {unit.aisle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {unit.is_climate_controlled && <ThermometerSnowflake className="h-4 w-4 text-blue-500" />}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        unit.is_available ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {unit.is_available ? "Available" : "Occupied"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
