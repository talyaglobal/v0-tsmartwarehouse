"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { DollarSign, Package, Users, TrendingUp, Download } from "lucide-react"
import { mockDashboardStats, mockRevenueData, mockWarehouses } from "@/lib/mock-data"
import { formatCurrency } from "@/lib/utils/format"

const serviceDistribution = [
  { name: "Storage", value: 45, color: "#3b82f6" },
  { name: "Fulfillment", value: 30, color: "#10b981" },
  { name: "Cross-Dock", value: 15, color: "#f59e0b" },
  { name: "Value-Added", value: 10, color: "#8b5cf6" },
]

const warehouseUtilization = mockWarehouses.map((w) => ({
  name: w.code,
  utilization: Math.round((w.used_sqft / w.capacity_sqft) * 100),
  capacity: w.capacity_sqft,
}))

export default function AnalyticsPage() {
  const [period, setPeriod] = React.useState("6m")
  const stats = mockDashboardStats

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Insights and performance metrics">
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="6m">Last 6 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.total_revenue)}
          icon={DollarSign}
          trend={{ value: 12.5, isPositive: true }}
          description="vs last period"
        />
        <StatCard
          title="Total Bookings"
          value={stats.total_bookings}
          icon={Package}
          trend={{ value: 8.2, isPositive: true }}
          description="vs last period"
        />
        <StatCard
          title="Total Customers"
          value={stats.total_customers}
          icon={Users}
          trend={{ value: 5.1, isPositive: true }}
          description="vs last period"
        />
        <StatCard
          title="Avg. Utilization"
          value={`${stats.warehouse_utilization}%`}
          icon={TrendingUp}
          trend={{ value: 2.3, isPositive: true }}
          description="across warehouses"
        />
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>Monthly revenue and booking trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockRevenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  className="text-xs"
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">
                            Revenue: {formatCurrency(payload[0].value as number)}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Warehouse Utilization */}
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Utilization</CardTitle>
            <CardDescription>Capacity usage by facility</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={warehouseUtilization} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <p className="text-sm font-medium">{payload[0].payload.name}</p>
                            <p className="text-sm text-muted-foreground">Utilization: {payload[0].value}%</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="utilization" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Service Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Service Distribution</CardTitle>
            <CardDescription>Revenue by service type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {serviceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <p className="text-sm font-medium">{payload[0].name}</p>
                            <p className="text-sm text-muted-foreground">{payload[0].value}% of revenue</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
