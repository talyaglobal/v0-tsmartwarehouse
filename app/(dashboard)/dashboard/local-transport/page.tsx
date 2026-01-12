"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Truck, 
  Users, 
  Calendar,
  Clock, 
  CheckCircle2, 
  MapPin,
  ArrowRight,
  Eye,
  Plus,
  Route
} from "lucide-react"
import { useUser } from "@/lib/hooks/use-user"
import Link from "next/link"

interface DashboardSummary {
  activeJobs: number
  availableDrivers: number
  completedToday: number
  pendingPickups: number
}

export default function LocalTransportDashboard() {
  const { user } = useUser()
  const [activeTab, setActiveTab] = useState("jobs")

  // Fetch shipments assigned to this transport company
  const { data: shipments, isLoading: shipmentsLoading } = useQuery({
    queryKey: ["local-transport-shipments"],
    queryFn: async () => {
      const res = await fetch("/api/v1/shipments?localTransportId=current")
      if (!res.ok) throw new Error("Failed to fetch shipments")
      const data = await res.json()
      return data.data?.items || []
    },
    enabled: !!user,
  })

  // Fetch drivers for this company
  const { data: drivers, isLoading: driversLoading } = useQuery({
    queryKey: ["local-transport-drivers"],
    queryFn: async () => {
      const res = await fetch("/api/v1/transport-drivers?myCompany=true")
      if (!res.ok) throw new Error("Failed to fetch drivers")
      const data = await res.json()
      return data.data?.items || []
    },
    enabled: !!user,
  })

  const summary: DashboardSummary = {
    activeJobs: shipments?.filter((s: any) => ["dispatched", "picked_up", "in_transit", "out_for_delivery"].includes(s.status)).length || 0,
    availableDrivers: drivers?.filter((d: any) => d.availabilityStatus === "available").length || 0,
    completedToday: shipments?.filter((s: any) => {
      if (s.status !== "delivered") return false
      const today = new Date().toISOString().split("T")[0]
      return s.actualDeliveryAt?.startsWith(today)
    }).length || 0,
    pendingPickups: shipments?.filter((s: any) => ["pending", "confirmed"].includes(s.status)).length || 0,
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      confirmed: { variant: "outline", label: "Confirmed" },
      dispatched: { variant: "default", label: "Dispatched" },
      picked_up: { variant: "default", label: "Picked Up" },
      in_transit: { variant: "default", label: "In Transit" },
      out_for_delivery: { variant: "default", label: "Out for Delivery" },
      delivered: { variant: "secondary", label: "Delivered" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    }
    const config = variants[status] || { variant: "outline", label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getAvailabilityBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      available: { variant: "default", label: "Available" },
      on_job: { variant: "secondary", label: "On Job" },
      off_duty: { variant: "outline", label: "Off Duty" },
      unavailable: { variant: "destructive", label: "Unavailable" },
    }
    const config = variants[status] || { variant: "outline", label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Local Transport Dashboard</h1>
          <p className="text-muted-foreground">
            Manage drivers, vehicles, and local deliveries
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/local-transport/drivers/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Driver
            </Link>
          </Button>
          <Button>
            <Route className="mr-2 h-4 w-4" />
            Dispatch Route
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeJobs}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Drivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.availableDrivers}</div>
            <p className="text-xs text-muted-foreground">Ready for dispatch</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.completedToday}</div>
            <p className="text-xs text-muted-foreground">Deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Pickups</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.pendingPickups}</div>
            <p className="text-xs text-muted-foreground">Awaiting dispatch</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="jobs">Active Jobs</TabsTrigger>
          <TabsTrigger value="drivers">Drivers ({drivers?.length || 0})</TabsTrigger>
          <TabsTrigger value="schedule">Today's Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Jobs</CardTitle>
              <CardDescription>Active pickups and deliveries</CardDescription>
            </CardHeader>
            <CardContent>
              {shipmentsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : shipments?.filter((s: any) => !["delivered", "cancelled"].includes(s.status)).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No active jobs</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {shipments?.filter((s: any) => !["delivered", "cancelled"].includes(s.status)).map((shipment: any) => (
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
                          {shipment.driver && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {shipment.driver.fullName}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/local-transport/jobs/${shipment.id}`}>
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

        <TabsContent value="drivers">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Drivers</CardTitle>
                <CardDescription>Manage your driver fleet</CardDescription>
              </div>
              <Button size="sm" asChild>
                <Link href="/dashboard/local-transport/drivers/new">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Driver
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {driversLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : !drivers?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No drivers registered</p>
                  <Button className="mt-4" asChild>
                    <Link href="/dashboard/local-transport/drivers/new">Add First Driver</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {drivers.map((driver: any) => (
                    <div key={driver.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{driver.fullName}</span>
                            {getAvailabilityBadge(driver.availabilityStatus)}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            {driver.licensePlate && (
                              <span className="flex items-center gap-1">
                                <Truck className="h-3 w-3" />
                                {driver.licensePlate}
                              </span>
                            )}
                            {driver.phone && <span>{driver.phone}</span>}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/local-transport/drivers/${driver.id}`}>
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

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
              <CardDescription>Pickups and deliveries scheduled for today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No scheduled pickups or deliveries for today</p>
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
        <CardContent className="flex flex-wrap gap-4">
          <Button variant="outline" asChild>
            <Link href="/dashboard/local-transport/vehicles">
              <Truck className="mr-2 h-4 w-4" />
              Manage Vehicles
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/local-transport/schedule">
              <Calendar className="mr-2 h-4 w-4" />
              View Full Schedule
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/local-transport/settings">
              Company Settings
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
