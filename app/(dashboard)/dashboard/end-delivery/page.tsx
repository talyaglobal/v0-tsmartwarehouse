"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Package, 
  Truck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Calendar,
  MapPin,
  ArrowRight,
  Eye
} from "lucide-react"
import { useUser } from "@/lib/hooks/use-user"
import Link from "next/link"

interface ShipmentSummary {
  pending: number
  inTransit: number
  delivered: number
  exceptions: number
}

export default function EndDeliveryDashboard() {
  const { user } = useUser()
  const [activeTab, setActiveTab] = useState("pending")

  // Fetch shipments assigned to this end delivery party
  const { data: shipments, isLoading: shipmentsLoading } = useQuery({
    queryKey: ["end-delivery-shipments"],
    queryFn: async () => {
      const res = await fetch("/api/v1/shipments?endDeliveryPartyId=current")
      if (!res.ok) throw new Error("Failed to fetch shipments")
      const data = await res.json()
      return data.data?.items || []
    },
    enabled: !!user,
  })

  // Calculate summary
  const summary: ShipmentSummary = {
    pending: shipments?.filter((s: any) => ["pending", "confirmed"].includes(s.status)).length || 0,
    inTransit: shipments?.filter((s: any) => ["in_transit", "out_for_delivery"].includes(s.status)).length || 0,
    delivered: shipments?.filter((s: any) => s.status === "delivered").length || 0,
    exceptions: shipments?.filter((s: any) => ["on_hold", "exception"].includes(s.status)).length || 0,
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      confirmed: { variant: "outline", label: "Confirmed" },
      dispatched: { variant: "default", label: "Dispatched" },
      in_transit: { variant: "default", label: "In Transit" },
      out_for_delivery: { variant: "default", label: "Out for Delivery" },
      delivered: { variant: "secondary", label: "Delivered" },
      on_hold: { variant: "destructive", label: "On Hold" },
      exception: { variant: "destructive", label: "Exception" },
    }
    const config = variants[status] || { variant: "outline", label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">End Delivery Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your deliveries and track incoming shipments
          </p>
        </div>
        <Button>
          <Calendar className="mr-2 h-4 w-4" />
          Schedule Pickup
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting pickup</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.inTransit}</div>
            <p className="text-xs text-muted-foreground">On the way</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.delivered}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exceptions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{summary.exceptions}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Shipments List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({summary.pending})</TabsTrigger>
          <TabsTrigger value="in-transit">In Transit ({summary.inTransit})</TabsTrigger>
          <TabsTrigger value="delivered">Delivered ({summary.delivered})</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions ({summary.exceptions})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Deliveries</CardTitle>
              <CardDescription>Shipments waiting for pickup or confirmation</CardDescription>
            </CardHeader>
            <CardContent>
              {shipmentsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : shipments?.filter((s: any) => ["pending", "confirmed"].includes(s.status)).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No pending deliveries</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shipments?.filter((s: any) => ["pending", "confirmed"].includes(s.status)).map((shipment: any) => (
                    <div key={shipment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{shipment.shipmentNumber}</span>
                          {getStatusBadge(shipment.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {shipment.originCity || "N/A"}
                          </span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {shipment.destinationCity || "N/A"}
                          </span>
                          {shipment.palletCount && (
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {shipment.palletCount} pallets
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/end-delivery/shipments/${shipment.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="in-transit">
          <Card>
            <CardHeader>
              <CardTitle>Shipments In Transit</CardTitle>
              <CardDescription>Track your incoming deliveries</CardDescription>
            </CardHeader>
            <CardContent>
              {shipmentsLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No shipments currently in transit</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivered">
          <Card>
            <CardHeader>
              <CardTitle>Delivered Shipments</CardTitle>
              <CardDescription>Successfully completed deliveries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No delivered shipments to display</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exceptions">
          <Card>
            <CardHeader>
              <CardTitle>Shipment Exceptions</CardTitle>
              <CardDescription>Issues that need your attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No exceptions to display</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            View Calendar
          </Button>
          <Button variant="outline">
            <Truck className="mr-2 h-4 w-4" />
            Track All Shipments
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/end-delivery/settings">
              Company Settings
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
