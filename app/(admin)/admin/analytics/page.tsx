"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, TrendingUp, DollarSign, Users, Download, Loader2 } from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"
import { RevenueChart } from "@/components/charts/revenue-chart"
import { UtilizationChart } from "@/components/charts/utilization-chart"
import { ServiceBreakdownChart } from "@/components/charts/service-breakdown-chart"

interface RevenueData {
  month: string
  pallet: number
  areaRental: number
}

interface UtilizationData {
  month: string
  floor1: number
  floor2: number
  floor3: number
}

interface ServiceBreakdown {
  name: string
  value: number
  color: string
}

interface AnalyticsStats {
  totalRevenue: number
  monthlyRevenue: number
  warehouseUtilization: number
  totalCustomers: number
  avgRevenuePerCustomer: number
  customerRetentionRate: number
  avgBookingDuration: number
  storageEfficiency: number
  areaRentalRate: number
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([])
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdown[]>([])
  const [stats, setStats] = useState<AnalyticsStats | null>(null)

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/analytics?type=all&months=6')
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const result = await response.json()
      
      if (result.success) {
        setRevenueData(result.data.revenue || [])
        setUtilizationData(result.data.utilization || [])
        setServiceBreakdown(result.data.serviceBreakdown || [])
        setStats(result.data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
      // Fallback to empty data
      setRevenueData([])
      setUtilizationData([])
      setServiceBreakdown([])
    } finally {
      setLoading(false)
    }
  }
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Total Revenue"
              value={formatCurrency(stats?.totalRevenue || 0)}
              icon={DollarSign}
              trend={{ value: 15, isPositive: true }}
            />
            <StatCard
              title="Monthly Revenue"
              value={formatCurrency(stats?.monthlyRevenue || 0)}
              icon={TrendingUp}
              trend={{ value: 8, isPositive: true }}
            />
            <StatCard
              title="Utilization"
              value={(stats?.warehouseUtilization || 0) + "%"}
              icon={BarChart3}
              description="Across all floors"
            />
            <StatCard
              title="Active Customers"
              value={(stats?.totalCustomers || 0).toString()}
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
                    <span className="font-medium">{formatCurrency(stats?.avgRevenuePerCustomer || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Customer Retention Rate</span>
                    <span className="font-medium">{stats?.customerRetentionRate || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg. Booking Duration</span>
                    <span className="font-medium">{stats?.avgBookingDuration || 0} months</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Storage Efficiency</span>
                    <span className="font-medium">{stats?.storageEfficiency || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Area Rental Rate</span>
                    <span className="font-medium">${stats?.areaRentalRate || 0}/sq ft/year</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  )
}
