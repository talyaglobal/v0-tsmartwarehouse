"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge, SeverityBadge } from "@/components/ui/status-badge"
import { Package, DollarSign, Users, Building2, AlertCircle, ClipboardList, Wifi, Loader2 } from "@/components/icons"
import { useRealtimeWarehouseUtilization } from "@/lib/realtime"
import { formatCurrency, formatNumber } from "@/lib/utils/format"
import type { Booking, Incident, Task } from "@/types"

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeBookings: 0,
    totalCustomers: 0,
  })
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [openIncidents, setOpenIncidents] = useState<Incident[]>([])
  const [pendingTasks, setPendingTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  
  // Real-time warehouse utilization
  const { utilization, isConnected } = useRealtimeWarehouseUtilization()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch analytics stats
      const statsRes = await fetch('/api/v1/analytics?type=stats')
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats({
          totalRevenue: statsData.data?.totalRevenue || 0,
          activeBookings: 0, // Will be calculated from bookings
          totalCustomers: statsData.data?.totalCustomers || 0,
        })
      }

      // Fetch recent bookings
      const bookingsRes = await fetch('/api/v1/bookings?limit=5')
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setRecentBookings(bookingsData.data || [])
        setStats(prev => ({
          ...prev,
          activeBookings: (bookingsData.data || []).filter((b: Booking) => 
            b.status === 'active' || b.status === 'confirmed'
          ).length,
        }))
      }

      // Fetch open incidents
      const incidentsRes = await fetch('/api/v1/incidents?status=open,investigating')
      if (incidentsRes.ok) {
        const incidentsData = await incidentsRes.json()
        setOpenIncidents(incidentsData.data || [])
      }

      // Fetch pending tasks
      const tasksRes = await fetch('/api/v1/tasks?status=pending,assigned')
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setPendingTasks(tasksData.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

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
          value={`${utilization.utilizationPercent}%`}
          icon={Building2}
          subtitle={`${formatNumber(utilization.totalSqFt)} sq ft total`}
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Warehouse Layout - 3 Floors</CardTitle>
              <CardDescription>
                {formatNumber(utilization.totalSqFt)} sq ft total capacity across 3 floors
                {isConnected && (
                  <span className="ml-2 flex items-center gap-1 text-green-600">
                    <Wifi className="h-3 w-3" />
                    Live
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {utilization.floors.map((floor) => (
              <div key={floor.floorNumber} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Floor {floor.floorNumber}</h4>
                  {floor.floorNumber === 3 && <Badge variant="secondary">Area Rental</Badge>}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span>{formatNumber(floor.totalSqFt)} sq ft</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Utilization</span>
                    <span className={floor.utilizationPercent > 80 ? "text-amber-600" : "text-green-600"}>
                      {floor.utilizationPercent}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${floor.utilizationPercent > 80 ? "bg-amber-500" : "bg-green-500"}`}
                      style={{ width: `${floor.utilizationPercent}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {floor.halls.map((hall) => (
                      <div key={hall.hallName} className="text-xs p-2 bg-muted rounded">
                        <div className="font-medium">Hall {hall.hallName}</div>
                        <div className="text-muted-foreground">{formatNumber(hall.availableSqFt)} available</div>
                        <div className="text-muted-foreground text-[10px]">{hall.utilizationPercent}% used</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
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
