import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Package, Users, DollarSign, Warehouse, AlertTriangle, ClipboardList, Calendar } from "lucide-react"
import { mockDashboardStats, mockBookings, mockIncidents, mockTasks, mockCustomers } from "@/lib/mock-data"
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils/format"
import Link from "next/link"

export default function AdminDashboard() {
  const stats = mockDashboardStats
  const recentBookings = mockBookings.slice(0, 5)
  const openIncidents = mockIncidents.filter((i) => i.status !== "closed")
  const pendingTasks = mockTasks.filter((t) => t.status === "pending" || t.status === "in_progress")

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your warehouse operations">
        <Button asChild>
          <Link href="/admin/bookings/new">
            <Calendar className="mr-2 h-4 w-4" />
            New Booking
          </Link>
        </Button>
      </PageHeader>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.total_revenue)}
          icon={DollarSign}
          trend={{ value: 12.5, isPositive: true }}
          description="from last month"
        />
        <StatCard
          title="Active Bookings"
          value={stats.active_bookings}
          icon={Package}
          trend={{ value: 8, isPositive: true }}
          description="from last month"
        />
        <StatCard
          title="Total Customers"
          value={stats.total_customers}
          icon={Users}
          trend={{ value: 4, isPositive: true }}
          description={`${stats.new_customers_this_month} new this month`}
        />
        <StatCard
          title="Warehouse Utilization"
          value={`${stats.warehouse_utilization}%`}
          icon={Warehouse}
          description="across all facilities"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Pending Bookings"
          value={stats.pending_bookings}
          icon={Calendar}
          className="border-l-4 border-l-amber-500"
        />
        <StatCard
          title="Open Incidents"
          value={stats.open_incidents}
          icon={AlertTriangle}
          className="border-l-4 border-l-red-500"
        />
        <StatCard
          title="Pending Tasks"
          value={stats.pending_tasks}
          icon={ClipboardList}
          className="border-l-4 border-l-blue-500"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Bookings</CardTitle>
              <CardDescription>Latest booking requests</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/bookings">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentBookings.map((booking) => {
                const customer = mockCustomers.find((c) => c.id === booking.customer_id)
                return (
                  <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {customer?.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{booking.booking_number}</p>
                        <p className="text-xs text-muted-foreground">{customer?.company_name || customer?.full_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatCurrency(booking.total_amount)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(booking.start_date)}</p>
                      </div>
                      <StatusBadge type="booking" status={booking.status} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Open Incidents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Open Incidents</CardTitle>
              <CardDescription>Requires attention</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/incidents">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {openIncidents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No open incidents</p>
                </div>
              ) : (
                openIncidents.map((incident) => (
                  <div key={incident.id} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div
                      className={`mt-0.5 h-2 w-2 rounded-full ${
                        incident.severity === "critical"
                          ? "bg-red-500"
                          : incident.severity === "high"
                            ? "bg-orange-500"
                            : incident.severity === "medium"
                              ? "bg-amber-500"
                              : "bg-gray-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{incident.title}</p>
                        <StatusBadge type="severity" status={incident.severity} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {incident.incident_number} • {formatRelativeTime(incident.reported_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Tasks</CardTitle>
              <CardDescription>Tasks requiring attention</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/tasks">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingTasks.map((task) => (
                <div key={task.id} className="p-4 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between">
                    <StatusBadge type="priority" status={task.priority} />
                    <StatusBadge type="task" status={task.status} />
                  </div>
                  <h4 className="font-medium text-sm">{task.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                  {task.due_date && <p className="text-xs text-muted-foreground">Due: {formatDate(task.due_date)}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
