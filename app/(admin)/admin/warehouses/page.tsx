"use client"

import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Warehouse, Building2, Package, Layers, MapPin, Clock, Square } from "@/components/icons"
import { WAREHOUSE_LAYOUT, PRICING } from "@/lib/constants"
import { formatCurrency, formatNumber } from "@/lib/utils/format"

export default function WarehousesPage() {
  const totalSqFt = WAREHOUSE_LAYOUT.totalSqFt
  const occupiedSqFt = 156000 // Mock data
  const utilizationPercent = Math.round((occupiedSqFt / totalSqFt) * 100)

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouse Management" description="Monitor warehouse capacity and layout" />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Capacity"
          value={formatNumber(totalSqFt) + " sq ft"}
          icon={Building2}
          subtitle="240,000 sq ft facility"
        />
        <StatCard
          title="Utilization"
          value={utilizationPercent + "%"}
          icon={Layers}
          description={formatNumber(occupiedSqFt) + " sq ft occupied"}
        />
        <StatCard title="Active Pallets" value="2,450" icon={Package} subtitle="Across all floors" />
        <StatCard title="Area Rentals" value="2" icon={Square} subtitle="Level 3 leases" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {WAREHOUSE_LAYOUT.floors.map((floor) => {
          const floorOccupied = floor.floorNumber === 3 ? 40000 : floor.floorNumber === 2 ? 60000 : 56000
          const floorUtil = Math.round((floorOccupied / floor.totalSqFt) * 100)

          return (
            <Card key={floor.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      {floor.name}
                    </CardTitle>
                    <CardDescription>{formatNumber(floor.totalSqFt)} sq ft total</CardDescription>
                  </div>
                  {floor.floorNumber === 3 && (
                    <Badge variant="outline" className="text-primary border-primary">
                      Area Rental
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Utilization</span>
                    <span className="font-medium">{floorUtil}%</span>
                  </div>
                  <Progress value={floorUtil} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {floor.halls.map((hall) => {
                    const hallOccupied = hall.hallName === "A" ? floorOccupied * 0.6 : floorOccupied * 0.4
                    const hallUtil = Math.round((hallOccupied / hall.sqFt) * 100)

                    return (
                      <div key={hall.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Hall {hall.hallName}</span>
                          <span className="text-xs text-muted-foreground">{hallUtil}%</span>
                        </div>
                        <Progress value={hallUtil} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">{formatNumber(hall.sqFt)} sq ft</p>
                      </div>
                    )
                  })}
                </div>

                {floor.floorNumber === 3 && (
                  <div className="rounded-lg bg-primary/5 p-3 text-sm">
                    <p className="font-medium text-primary">Area Rental Zone</p>
                    <p className="text-muted-foreground">
                      {formatCurrency(PRICING.areaRentalPerSqFtPerYear)}/sq ft/year
                    </p>
                    <p className="text-muted-foreground">Min: {formatNumber(PRICING.areaRentalMinSqFt)} sq ft</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facility Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Location</p>
                <p className="text-sm text-muted-foreground">
                  {WAREHOUSE_LAYOUT.address}
                  <br />
                  {WAREHOUSE_LAYOUT.city}, {WAREHOUSE_LAYOUT.state} {WAREHOUSE_LAYOUT.zipCode}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Operating Hours</p>
                <p className="text-sm text-muted-foreground">
                  {WAREHOUSE_LAYOUT.operatingHours.days.join(", ")}
                  <br />
                  {WAREHOUSE_LAYOUT.operatingHours.open} - {WAREHOUSE_LAYOUT.operatingHours.close}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Warehouse className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Amenities</p>
                <p className="text-sm text-muted-foreground">{WAREHOUSE_LAYOUT.amenities.slice(0, 4).join(", ")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
