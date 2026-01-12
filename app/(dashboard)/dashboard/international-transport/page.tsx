"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Plane,
  Ship,
  Truck, 
  FileText,
  CheckCircle2, 
  AlertTriangle,
  MapPin,
  Package,
  ArrowRight,
  Eye,
  Globe,
  FileCheck
} from "lucide-react"
import { useUser } from "@/lib/hooks/use-user"
import Link from "next/link"

interface DashboardSummary {
  activeShipments: number
  atCustoms: number
  delivered: number
  documents: number
}

export default function InternationalTransportDashboard() {
  const { user } = useUser()
  const [activeTab, setActiveTab] = useState("shipments")

  // Fetch international shipments
  const { data: shipments, isLoading: shipmentsLoading } = useQuery({
    queryKey: ["international-transport-shipments"],
    queryFn: async () => {
      const res = await fetch("/api/v1/shipments?internationalTransportId=current")
      if (!res.ok) throw new Error("Failed to fetch shipments")
      const data = await res.json()
      return data.data?.items || []
    },
    enabled: !!user,
  })

  const summary: DashboardSummary = {
    activeShipments: shipments?.filter((s: any) => !["delivered", "cancelled"].includes(s.status)).length || 0,
    atCustoms: shipments?.filter((s: any) => s.status === "at_customs").length || 0,
    delivered: shipments?.filter((s: any) => s.status === "delivered").length || 0,
    documents: shipments?.filter((s: any) => s.customsDeclarationNumber).length || 0,
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      confirmed: { variant: "outline", label: "Confirmed" },
      dispatched: { variant: "default", label: "Dispatched" },
      picked_up: { variant: "default", label: "Picked Up" },
      in_transit: { variant: "default", label: "In Transit" },
      at_customs: { variant: "destructive", label: "At Customs" },
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
          <h1 className="text-3xl font-bold tracking-tight">International Transport Dashboard</h1>
          <p className="text-muted-foreground">
            Manage cross-border shipments and customs documentation
          </p>
        </div>
        <Button>
          <FileText className="mr-2 h-4 w-4" />
          New Shipment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shipments</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeShipments}</div>
            <p className="text-xs text-muted-foreground">Currently in transit</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Customs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{summary.atCustoms}</div>
            <p className="text-xs text-muted-foreground">Awaiting clearance</p>
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
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.documents}</div>
            <p className="text-xs text-muted-foreground">With customs declarations</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="shipments">All Shipments</TabsTrigger>
          <TabsTrigger value="customs">Customs ({summary.atCustoms})</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="shipments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>International Shipments</CardTitle>
              <CardDescription>Track cross-border deliveries</CardDescription>
            </CardHeader>
            <CardContent>
              {shipmentsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : !shipments?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No international shipments</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shipments.map((shipment: any) => (
                    <div key={shipment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{shipment.shipmentNumber}</span>
                          {getStatusBadge(shipment.status)}
                          {shipment.isHazmat && (
                            <Badge variant="destructive">HAZMAT</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {shipment.originCountry || "N/A"}
                          </span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {shipment.destinationCountry || "N/A"}
                          </span>
                          {shipment.palletCount && (
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {shipment.palletCount} pallets
                            </span>
                          )}
                        </div>
                        {shipment.customsDeclarationNumber && (
                          <div className="flex items-center gap-2 mt-2 text-xs">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span>Customs: {shipment.customsDeclarationNumber}</span>
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/international-transport/shipments/${shipment.id}`}>
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

        <TabsContent value="customs">
          <Card>
            <CardHeader>
              <CardTitle>Customs Clearance</CardTitle>
              <CardDescription>Shipments awaiting customs clearance</CardDescription>
            </CardHeader>
            <CardContent>
              {shipmentsLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : summary.atCustoms === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No shipments at customs</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shipments?.filter((s: any) => s.status === "at_customs").map((shipment: any) => (
                    <div key={shipment.id} className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{shipment.shipmentNumber}</span>
                            {getStatusBadge(shipment.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {shipment.originCountry} → {shipment.destinationCountry}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          Update Status
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Shipping Documents</CardTitle>
              <CardDescription>Bills of lading, customs forms, and certificates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Document management coming soon</p>
                <Button className="mt-4" variant="outline">
                  Upload Document
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transport Modes */}
      <Card>
        <CardHeader>
          <CardTitle>Transport Modes</CardTitle>
          <CardDescription>Shipments by transport type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="p-3 bg-blue-100 dark:bg-blue-950 rounded-full">
                <Ship className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-muted-foreground">Sea Freight</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="p-3 bg-purple-100 dark:bg-purple-950 rounded-full">
                <Plane className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-muted-foreground">Air Freight</div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="p-3 bg-green-100 dark:bg-green-950 rounded-full">
                <Truck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm text-muted-foreground">Road Freight</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button variant="outline" asChild>
            <Link href="/dashboard/international-transport/rates">
              Rate Calculator
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/international-transport/tracking">
              <Globe className="mr-2 h-4 w-4" />
              Track Shipment
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/international-transport/settings">
              Company Settings
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
