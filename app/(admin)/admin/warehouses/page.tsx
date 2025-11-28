"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Progress } from "@/components/ui/progress"
import { mockWarehouses } from "@/lib/mock-data"
import { formatPercentage } from "@/lib/utils/format"
import { Plus, MapPin, Phone, Mail, Settings, BarChart3, Users } from "lucide-react"
import Link from "next/link"

export default function WarehousesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Warehouses" description="Manage warehouse facilities">
        <Button asChild>
          <Link href="/admin/warehouses/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Warehouse
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {mockWarehouses.map((warehouse) => {
          const utilization = (warehouse.used_sqft / warehouse.capacity_sqft) * 100
          return (
            <Card key={warehouse.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{warehouse.name}</CardTitle>
                    <CardDescription>{warehouse.code}</CardDescription>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      warehouse.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {warehouse.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Address */}
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p>{warehouse.address.street}</p>
                    <p className="text-muted-foreground">
                      {warehouse.address.city}, {warehouse.address.state} {warehouse.address.postal_code}
                    </p>
                  </div>
                </div>

                {/* Contact */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{warehouse.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{warehouse.email}</span>
                  </div>
                </div>

                {/* Utilization */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Capacity Utilization</span>
                    <span className="font-medium">{formatPercentage(utilization)}</span>
                  </div>
                  <Progress value={utilization} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {warehouse.used_sqft.toLocaleString()} / {warehouse.capacity_sqft.toLocaleString()} sq ft
                  </p>
                </div>

                {/* Amenities */}
                <div className="flex flex-wrap gap-1">
                  {warehouse.amenities.slice(0, 4).map((amenity) => (
                    <span key={amenity} className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs">
                      {amenity}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
                    <Link href={`/admin/warehouses/${warehouse.id}`}>
                      <Settings className="mr-2 h-4 w-4" />
                      Manage
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/warehouses/${warehouse.id}/analytics`}>
                      <BarChart3 className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/warehouses/${warehouse.id}/staff`}>
                      <Users className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
