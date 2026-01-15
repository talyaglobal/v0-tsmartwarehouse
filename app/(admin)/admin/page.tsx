"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge, SeverityBadge } from "@/components/ui/status-badge"
import { Progress } from "@/components/ui/progress"
import { 
  Package, DollarSign, Users, Building2, AlertCircle, ClipboardList, 
  Wifi, Loader2, TrendingUp, RefreshCw, MapPin, 
  Calendar, Clock, BarChart3, Eye, CheckCircle2, Package2
} from "@/components/icons"
import { useRealtimeWarehouseUtilization } from "@/lib/realtime"
import { formatCurrency, formatNumber } from "@/lib/utils/format"
import { WarehousesWorldMap } from "@/components/maps/warehouses-world-map"
import type { Booking, Incident, Task } from "@/types"

interface AnalyticsData {
  overview: {
    totalWarehouses: number
    totalUsers: number
    totalBookings: number
    totalRevenue: number
    activeBookings: number
    pendingBookings: number
    confirmedBookings: number
    completedBookings: number
    totalCompanies: number
  }
  usersByRole: Record<string, number>
  bookingsByStatus: Record<string, number>
  todayStats: {
    uniqueVisitors: number
    newBookings: number
    newUsers: number
    revenue: number
  }
  topWarehouses: Array<{
    id: string
    name: string
    city: string
    bookingCount: number
    revenue: number
  }>
  recentActivity: {
    lastHourBookings: number
    last24HoursBookings: number
    lastWeekBookings: number
  }
  warehousesByCity: Record<string, number>
  warehouseLocations: Array<{
    id: string
    name: string
    city: string
    address?: string
    lat?: number
    lng?: number
    bookingCount: number
  }>
  monthlyTrends: Array<{
    month: string
    bookings: number
    revenue: number
  }>
  capacityOverview: {
    totalPalletCapacity: number
    usedPalletCapacity: number
    totalAreaSqFt: number
    usedAreaSqFt: number
  }
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  root: { label: 'Root Admin', color: 'bg-red-500' },
  warehouse_admin: { label: 'Warehouse Admin', color: 'bg-emerald-500' },
  warehouse_supervisor: { label: 'Warehouse Supervisor', color: 'bg-blue-500' },
  warehouse_client: { label: 'Warehouse Client', color: 'bg-violet-500' },
  warehouse_staff: { label: 'Warehouse Staff', color: 'bg-slate-500' },
  warehouse_finder: { label: 'Warehouse Finder', color: 'bg-amber-500' },
  warehouse_broker: { label: 'Warehouse Broker', color: 'bg-orange-500' },
  end_delivery_party: { label: 'End Delivery', color: 'bg-pink-500' },
  local_transport: { label: 'Local Transport', color: 'bg-lime-500' },
  international_transport: { label: 'Int. Transport', color: 'bg-cyan-500' },
}

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [openIncidents, setOpenIncidents] = useState<Incident[]>([])
  const [pendingTasks, setPendingTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  // Real-time connection status
  const { isConnected } = useRealtimeWarehouseUtilization()

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      // Fetch comprehensive analytics
      const analyticsRes = await fetch('/api/v1/admin/analytics')
      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        if (data.success) {
          setAnalytics(data.data)
          setLastUpdated(new Date(data.timestamp))
        }
      }

      // Fetch recent bookings (limit 5, sorted by created_at desc)
      const bookingsRes = await fetch('/api/v1/bookings?limit=5')
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setRecentBookings(bookingsData.data || [])
      }

      // Fetch open incidents directly from Supabase for admin
      try {
        const incidentsRes = await fetch('/api/v1/incidents')
        if (incidentsRes.ok) {
          const incidentsData = await incidentsRes.json()
          // Filter for open/investigating status
          const openIncidentsList = (incidentsData.data || []).filter(
            (i: Incident) => i.status === 'open' || i.status === 'investigating'
          ).slice(0, 5)
          setOpenIncidents(openIncidentsList)
        }
      } catch (error) {
        console.error('Failed to fetch incidents:', error)
      }

      // Fetch pending tasks directly from Supabase for admin
      try {
        const tasksRes = await fetch('/api/v1/tasks')
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json()
          // Filter for pending/assigned status
          const pendingTasksList = (tasksData.data || []).filter(
            (t: Task) => t.status === 'pending' || t.status === 'assigned'
          ).slice(0, 5)
          setPendingTasks(pendingTasksList)
        }
      } catch (error) {
        console.error('Failed to fetch tasks:', error)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAnalytics(true)
    }, 30000)
    
    return () => clearInterval(interval)
  }, [fetchAnalytics])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalUsersByRole = Object.values(analytics?.usersByRole || {}).reduce((a, b) => a + b, 0)

  // Calculate capacity utilization percentages
  const palletUtilization = analytics?.capacityOverview?.totalPalletCapacity 
    ? Math.round((analytics.capacityOverview.usedPalletCapacity / analytics.capacityOverview.totalPalletCapacity) * 100)
    : 0
  const areaUtilization = analytics?.capacityOverview?.totalAreaSqFt
    ? Math.round((analytics.capacityOverview.usedAreaSqFt / analytics.capacityOverview.totalAreaSqFt) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <PageHeader title="Admin Dashboard" description="Real-time overview of platform operations" />
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {isConnected && (
            <Badge variant="outline" className="text-green-600 border-green-300">
              <Wifi className="h-3 w-3 mr-1" />
              Live
            </Badge>
          )}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard
          title="Total Warehouses"
          value={analytics?.overview.totalWarehouses || 0}
          icon={Building2}
          subtitle="registered"
        />
        <StatCard
          title="Total Users"
          value={analytics?.overview.totalUsers || 0}
          icon={Users}
          subtitle="all roles"
        />
        <StatCard
          title="Total Bookings"
          value={analytics?.overview.totalBookings || 0}
          icon={Package}
          subtitle="all time"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(analytics?.overview.totalRevenue || 0)}
          icon={DollarSign}
          subtitle="from bookings"
        />
        <StatCard
          title="Companies"
          value={analytics?.overview.totalCompanies || 0}
          icon={Building2}
          subtitle="registered"
        />
      </div>

      {/* Booking Status Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {analytics?.overview.activeBookings || 0}
                </p>
                <p className="text-sm text-green-600 dark:text-green-500">Active Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {analytics?.overview.confirmedBookings || 0}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-500">Confirmed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {analytics?.overview.pendingBookings || 0}
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-500">Pending Action</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Package2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {analytics?.overview.completedBookings || 0}
                </p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Stats */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>Today's Activity</CardTitle>
          </div>
          <CardDescription>Real-time statistics for today</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg bg-background border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Eye className="h-4 w-4" />
                <span className="text-sm">Unique Visitors</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.todayStats.uniqueVisitors || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-background border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                <span className="text-sm">New Bookings</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.todayStats.newBookings || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-background border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm">New Users</span>
              </div>
              <p className="text-2xl font-bold">{analytics?.todayStats.newUsers || 0}</p>
            </div>
            <div className="p-4 rounded-lg bg-background border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Revenue</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(analytics?.todayStats.revenue || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users by Role & Capacity Utilization */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Users by Role */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users by Role
            </CardTitle>
            <CardDescription>Distribution of {totalUsersByRole} users across roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics?.usersByRole || {})
                .sort((a, b) => b[1] - a[1])
                .map(([role, count]) => {
                  const roleInfo = ROLE_LABELS[role] || { label: role, color: 'bg-gray-500' }
                  const percentage = totalUsersByRole > 0 ? (count / totalUsersByRole) * 100 : 0
                  return (
                    <div key={role} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{roleInfo.label}</span>
                        <span className="text-muted-foreground">{count} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${roleInfo.color} transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>

        {/* Capacity Utilization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Capacity Utilization
            </CardTitle>
            <CardDescription>Current warehouse capacity usage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Pallet Capacity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Pallet Storage</span>
                  </div>
                  <span className={`font-bold ${palletUtilization > 80 ? 'text-red-500' : palletUtilization > 50 ? 'text-yellow-500' : 'text-green-500'}`}>
                    {palletUtilization}%
                  </span>
                </div>
                <Progress value={palletUtilization} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatNumber(analytics?.capacityOverview?.usedPalletCapacity || 0)} used</span>
                  <span>{formatNumber(analytics?.capacityOverview?.totalPalletCapacity || 0)} total pallets</span>
                </div>
              </div>

              {/* Area Capacity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium">Space Storage</span>
                  </div>
                  <span className={`font-bold ${areaUtilization > 80 ? 'text-red-500' : areaUtilization > 50 ? 'text-yellow-500' : 'text-green-500'}`}>
                    {areaUtilization}%
                  </span>
                </div>
                <Progress value={areaUtilization} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatNumber(analytics?.capacityOverview?.usedAreaSqFt || 0)} used</span>
                  <span>{formatNumber(analytics?.capacityOverview?.totalAreaSqFt || 0)} total sq ft</span>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-lg font-bold text-green-600">
                    {formatNumber((analytics?.capacityOverview?.totalPalletCapacity || 0) - (analytics?.capacityOverview?.usedPalletCapacity || 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">Available Pallets</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-lg font-bold text-green-600">
                    {formatNumber((analytics?.capacityOverview?.totalAreaSqFt || 0) - (analytics?.capacityOverview?.usedAreaSqFt || 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">Available sq ft</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Top Warehouses */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Booking Activity
            </CardTitle>
            <CardDescription>Recent booking trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Last Hour</p>
                    <p className="text-sm text-muted-foreground">New bookings</p>
                  </div>
                </div>
                <p className="text-2xl font-bold">{analytics?.recentActivity.lastHourBookings || 0}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Last 24 Hours</p>
                    <p className="text-sm text-muted-foreground">New bookings</p>
                  </div>
                </div>
                <p className="text-2xl font-bold">{analytics?.recentActivity.last24HoursBookings || 0}</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">Last 7 Days</p>
                    <p className="text-sm text-muted-foreground">New bookings</p>
                  </div>
                </div>
                <p className="text-2xl font-bold">{analytics?.recentActivity.lastWeekBookings || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Warehouses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Top Performing Warehouses
            </CardTitle>
            <CardDescription>By booking count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(analytics?.topWarehouses || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No warehouse data available</p>
              ) : (
                analytics?.topWarehouses.map((warehouse, index) => (
                  <div key={warehouse.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{warehouse.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {warehouse.city}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{warehouse.bookingCount} bookings</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(warehouse.revenue)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warehouses by City - World Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Warehouses by City
          </CardTitle>
          <CardDescription>
            Geographic distribution of {analytics?.overview.totalWarehouses || 0} warehouses across {Object.keys(analytics?.warehousesByCity || {}).length} cities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WarehousesWorldMap 
            warehouses={analytics?.warehouseLocations || []} 
            height="450px"
          />
          {/* City Summary Grid - 8 boxes total */}
          {(() => {
            const sortedCities = Object.entries(analytics?.warehousesByCity || {}).sort((a, b) => b[1] - a[1])
            const totalCities = sortedCities.length
            const displayCities = totalCities > 8 ? sortedCities.slice(0, 7) : sortedCities.slice(0, 8)
            const remainingCities = totalCities > 8 ? sortedCities.slice(7) : []
            
            return (
              <div className="grid gap-3 grid-cols-4 md:grid-cols-8 mt-4 pt-4 border-t">
                {displayCities.map(([city, count]) => (
                  <div key={city} className="p-2 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                    <p className="font-bold text-lg">{count}</p>
                    <p className="text-xs text-muted-foreground truncate" title={city}>{city}</p>
                  </div>
                ))}
                {remainingCities.length > 0 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="p-2 border rounded-lg text-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                        <p className="font-bold text-lg">+{remainingCities.length}</p>
                        <p className="text-xs text-muted-foreground">more cities</p>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <MapPin className="h-5 w-5" />
                          All Cities ({totalCities})
                        </DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="max-h-[400px] pr-4">
                        <div className="space-y-2">
                          {sortedCities.map(([city, count], index) => (
                            <div 
                              key={city} 
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                                <span className="font-medium">{city}</span>
                              </div>
                              <Badge variant="secondary" className="font-bold">
                                {count} {count === 1 ? 'warehouse' : 'warehouses'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Monthly Trends (Last 6 Months)
          </CardTitle>
          <CardDescription>Bookings and revenue over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
            {(analytics?.monthlyTrends || []).map((month) => (
              <div key={month.month} className="p-4 border rounded-lg text-center">
                <p className="text-sm font-medium text-muted-foreground mb-2">{month.month}</p>
                <p className="text-xl font-bold">{month.bookings}</p>
                <p className="text-xs text-muted-foreground">bookings</p>
                <p className="text-sm font-medium text-primary mt-1">{formatCurrency(month.revenue)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity Cards */}
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
              {recentBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent bookings</p>
              ) : (
                recentBookings.map((booking) => (
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
                ))
              )}
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
            <Link href="/warehouse/tasks">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No pending tasks</p>
              ) : (
                pendingTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-muted-foreground text-xs">{task.assignedToName || 'Unassigned'}</p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

