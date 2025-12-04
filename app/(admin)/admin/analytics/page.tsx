"use client"

import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, TrendingUp, DollarSign, Users, Download } from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"
import { mockDashboardStats } from "@/lib/mock-data"
import { RevenueChart } from "@/components/charts/revenue-chart"
import { UtilizationChart } from "@/components/charts/utilization-chart"
import { ServiceBreakdownChart } from "@/components/charts/service-breakdown-chart"

const revenueData = [
  { month: "Jan", pallet: 85000, areaRental: 40000 },
  { month: "Feb", pallet: 92000, areaRental: 40000 },
  { month: "Mar", pallet: 88000, areaRental: 40000 },
  { month: "Apr", pallet: 95000, areaRental: 40000 },
  { month: "May", pallet: 102000, areaRental: 80000 },
  { month: "Jun", pallet: 125000, areaRental: 80000 },
]

const utilizationData = [
  { month: "Jan", floor1: 65, floor2: 58, floor3: 25 },
  { month: "Feb", floor1: 68, floor2: 62, floor3: 25 },
  { month: "Mar", floor1: 70, floor2: 65, floor3: 50 },
  { month: "Apr", floor1: 72, floor2: 68, floor3: 50 },
  { month: "May", floor1: 75, floor2: 70, floor3: 50 },
  { month: "Jun", floor1: 78, floor2: 72, floor3: 50 },
]

const serviceBreakdown = [
  { name: "Pallet Storage", value: 65, color: "#3b82f6" },
  { name: "Area Rental", value: 25, color: "#10b981" },
  { name: "Handling Fees", value: 10, color: "#f59e0b" },
]

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Revenue, utilization, and performance metrics"
        action={
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(mockDashboardStats.totalRevenue)}
          icon={DollarSign}
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(mockDashboardStats.monthlyRevenue)}
          icon={TrendingUp}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Utilization"
          value={mockDashboardStats.warehouseUtilization + "%"}
          icon={BarChart3}
          description="Across all floors"
        />
        <StatCard
          title="Active Customers"
          value={mockDashboardStats.totalCustomers.toString()}
          icon={Users}
          trend={{ value: 5, isPositive: true }}
        />
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <RevenueChart data={revenueData} />
        </TabsContent>

        <TabsContent value="utilization">
          <UtilizationChart data={utilizationData} />
        </TabsContent>

        <TabsContent value="services">
          <div className="grid gap-6 lg:grid-cols-2">
            <ServiceBreakdownChart data={serviceBreakdown} />

            <Card>
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
                <CardDescription>Performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg. Revenue per Customer</span>
                    <span className="font-medium">{formatCurrency(14367)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Customer Retention Rate</span>
                    <span className="font-medium">94%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg. Booking Duration</span>
                    <span className="font-medium">4.2 months</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Storage Efficiency</span>
                    <span className="font-medium">87%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Area Rental Rate</span>
                    <span className="font-medium">$12/sq ft/year</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
