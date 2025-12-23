"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/ui/page-header"
import { Layers, Building2, Package, Thermometer, AlertTriangle, CheckCircle } from "@/components/icons"
import { WAREHOUSE_CONFIG, PRICING } from "@/lib/constants"
import { formatNumber, formatCurrency } from "@/lib/utils/format"

export default function WarehouseLayoutPage() {
  const [selectedFloor, setSelectedFloor] = useState("1")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Layout"
        description="3 Floors, 2 Halls per floor, 40,000 sq ft per hall = 240,000 sq ft total"
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(WAREHOUSE_CONFIG.totalSqFt)}</p>
                <p className="text-xs text-muted-foreground">Total sq ft</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-xs text-muted-foreground">Floors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">6</p>
                <p className="text-xs text-muted-foreground">Halls Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">68%</p>
                <p className="text-xs text-muted-foreground">Utilization</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floor Tabs */}
      <Tabs value={selectedFloor} onValueChange={setSelectedFloor}>
        <TabsList className="grid w-full grid-cols-3">
          {WAREHOUSE_CONFIG.floors.map((floor) => (
            <TabsTrigger key={floor.id} value={String(floor.floorNumber)}>
              {floor.name}
              {floor.floorNumber === 3 && (
                <Badge variant="secondary" className="ml-2">
                  Area Rental
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {WAREHOUSE_CONFIG.floors.map((floor) => (
          <TabsContent key={floor.id} value={String(floor.floorNumber)} className="space-y-6">
            {/* Floor Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{floor.name}</CardTitle>
                    <CardDescription>{formatNumber(floor.totalSqFt)} sq ft total capacity</CardDescription>
                  </div>
                  {floor.floorNumber === 3 && (
                    <div className="text-right">
                      <Badge className="mb-1">Area Rental Only</Badge>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(PRICING.areaRentalPerSqFtPerYear)}/sq ft/year
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Min: {formatNumber(PRICING.areaRentalMinSqFt)} sq ft
                      </p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Halls Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  {floor.halls.map((hall) => {
                    const utilization = Math.round((hall.occupiedSqFt / hall.sqFt) * 100)

                    return (
                      <Card key={hall.id} className="border-2">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Hall {hall.hallName}</CardTitle>
                            <Badge
                              variant={utilization > 80 ? "destructive" : utilization > 50 ? "default" : "secondary"}
                            >
                              {utilization}% Full
                            </Badge>
                          </div>
                          <CardDescription>{formatNumber(hall.sqFt)} sq ft</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Capacity Bar */}
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Capacity</span>
                              <span>
                                {formatNumber(hall.occupiedSqFt)} / {formatNumber(hall.sqFt)} sq ft
                              </span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  utilization > 80 ? "bg-red-500" : utilization > 50 ? "bg-amber-500" : "bg-green-500"
                                }`}
                                style={{ width: `${utilization}%` }}
                              />
                            </div>
                          </div>

                          {/* Available Space */}
                          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="font-medium text-green-700 dark:text-green-400">
                                {formatNumber(hall.availableSqFt)} sq ft available
                              </span>
                            </div>
                          </div>

                          {/* Zones */}
                          {floor.floorNumber !== 3 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Zones</p>
                              {hall.zones.map((zone) => (
                                <div
                                  key={zone.id}
                                  className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    {zone.type === "cold-storage" && <Thermometer className="h-4 w-4 text-blue-500" />}
                                    {zone.type === "hazmat" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                                    {zone.type === "pallet" && <Package className="h-4 w-4 text-gray-500" />}
                                    <span>{zone.name}</span>
                                  </div>
                                  <span className="text-muted-foreground">
                                    {zone.availableSlots}/{zone.totalSlots} slots
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Area Rental Info for Level 3 */}
                          {floor.floorNumber === 3 && (
                            <div className="space-y-2">
                              <div className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium">Area Rental Zone</span>
                                  <Badge variant="outline">Available</Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Annual Cost</p>
                                    <p className="font-medium">
                                      {formatCurrency(hall.sqFt * PRICING.areaRentalPerSqFtPerYear)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Monthly Cost</p>
                                    <p className="font-medium">
                                      {formatCurrency((hall.sqFt * PRICING.areaRentalPerSqFtPerYear) / 12)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zone Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              <span className="text-sm">Standard Pallet Storage</span>
            </div>
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Cold Storage</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Hazmat Storage</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-sm">Area Rental (Level 3 Only)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
