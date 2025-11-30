import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge, SeverityBadge } from "@/components/ui/status-badge"
import { Package, DollarSign, Users, Building2, AlertCircle, ClipboardList } from "@/components/icons"
import { mockBookings, mockIncidents, mockTasks, mockDashboardStats } from "@/lib/mock-data"
import { WAREHOUSE_CONFIG } from "@/lib/constants"
import { formatCurrency, formatNumber } from "@/lib/utils/format"

export default function AdminDashboardPage() {
  const stats = mockDashboardStats
  const recentBookings = mockBookings.slice(0, 5)
  const openIncidents = mockIncidents.filter((i) => i.status !== "closed")
  const pendingTasks = mockTasks.filter((t) => t.status === "pending" || t.status === "assigned")

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Dashboard" description="Overview of warehouse operations" />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          trend={{ value: 12, isPositive: true }}
          subtitle="from last month"
        />
        <StatCard
          title="Active Bookings"
          value={stats.activeBookings}
          icon={Package}
          trend={{ value: 8, isPositive: true }}
          subtitle="across all floors"
        />
        <StatCard
          title="Warehouse Utilization"
          value={`${stats.warehouseUtilization}%`}
          icon={Building2}
          subtitle={`${formatNumber(WAREHOUSE_CONFIG.totalSqFt)} sq ft total`}
        />
        <StatCard
          title="Total Customers"
          value={stats.totalCustomers}
          icon={Users}
          trend={{ value: 5, isPositive: true }}
          subtitle="active accounts"
        />
      </div>

      {/* Warehouse Layout Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Warehouse Layout - 3 Floors</CardTitle>
          <CardDescription>
            {formatNumber(WAREHOUSE_CONFIG.totalSqFt)} sq ft total capacity across 3 floors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {WAREHOUSE_CONFIG.floors.map((floor) => {
              const totalOccupied = floor.halls.reduce((sum, h) => sum + h.occupiedSqFt, 0)
              const utilization = Math.round((totalOccupied / floor.totalSqFt) * 100)

              return (
                <div key={floor.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{floor.name}</h4>
                    {floor.floorNumber === 3 && <Badge variant="secondary">Area Rental</Badge>}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total</span>
                      <span>{formatNumber(floor.totalSqFt)} sq ft</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className={utilization > 80 ? "text-amber-600" : "text-green-600"}>{utilization}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${utilization > 80 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${utilization}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {floor.halls.map((hall) => (
                        <div key={hall.id} className="text-xs p-2 bg-muted rounded">
                          <div className="font-medium">Hall {hall.hallName}</div>
                          <div className="text-muted-foreground">{formatNumber(hall.availableSqFt)} available</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Bookings</CardTitle>
            <Link href="/admin/bookings">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{booking.customerName}</p>
                    <p className="text-muted-foreground text-xs">
                      {booking.type === "pallet"
                        ? `${booking.palletCount} pallets`
                        : `${formatNumber(booking.areaSqFt || 0)} sq ft`}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Open Incidents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Open Incidents
            </CardTitle>
            <Link href="/admin/incidents">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {openIncidents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No open incidents</p>
              ) : (
                openIncidents.map((incident) => (
                  <div key={incident.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{incident.title}</p>
                      <p className="text-muted-foreground text-xs">{incident.location}</p>
                    </div>
                    <SeverityBadge severity={incident.severity} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Pending Tasks
            </CardTitle>
            <Link href="/admin/tasks">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-muted-foreground text-xs">{task.assignedToName}</p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
