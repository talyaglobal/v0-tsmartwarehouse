"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LineChart, Target, TrendingUp, Download, Loader2, AlertCircle } from "@/components/icons"
import { formatNumber } from "@/lib/utils/format"
import { PerformanceMenuItem } from "@/components/admin/performance-menu-item"
import { api } from "@/lib/api/client"
import type { PerformanceMetrics, Broker, CustomerGroup } from "@/lib/db/performance"
import { cn } from "@/lib/utils"

type FilterType = "all" | "floor" | "warehouse" | "customer" | "broker" | "customer_group"

export default function PerformancePage() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [, setBrokers] = useState<Broker[]>([])
  const [, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [filterValue, setFilterValue] = useState<string | number | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)

  useEffect(() => {
    fetchPerformanceData()
    fetchBrokersAndGroups()
  }, [activeFilter, filterValue, selectedFloor])

  const fetchPerformanceData = async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      
      if (activeFilter === "floor" && selectedFloor) {
        queryParams.set("floor", String(selectedFloor))
      } else if (activeFilter === "warehouse" && filterValue) {
        queryParams.set("warehouseId", String(filterValue))
      } else if (activeFilter === "customer" && filterValue) {
        queryParams.set("customerId", String(filterValue))
      } else if (activeFilter === "broker" && filterValue) {
        queryParams.set("brokerId", String(filterValue))
      } else if (activeFilter === "customer_group" && filterValue) {
        queryParams.set("customerGroupId", String(filterValue))
      }

      const url = `/api/v1/performance?${queryParams.toString()}`
      const result = await api.get<PerformanceMetrics>(url, { showToast: false })
      
      if (result.success && result.data) {
        setMetrics(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch performance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBrokersAndGroups = async () => {
    try {
      const [brokersResult, groupsResult] = await Promise.all([
        api.get<Broker[]>('/api/v1/performance?type=brokers', { showToast: false }),
        api.get<CustomerGroup[]>('/api/v1/performance?type=groups', { showToast: false }),
      ])

      if (brokersResult.success && brokersResult.data) {
        setBrokers(brokersResult.data)
      }
      if (groupsResult.success && groupsResult.data) {
        setCustomerGroups(groupsResult.data)
      }
    } catch (error) {
      console.error('Failed to fetch brokers and groups:', error)
    }
  }

  const handleFilterClick = (filter: FilterType, value?: string | number) => {
    if (activeFilter === filter && filterValue === value) {
      setActiveFilter("all")
      setFilterValue(null)
      setSelectedFloor(null)
    } else {
      setActiveFilter(filter)
      setFilterValue(value || null)
      if (filter === "floor") {
        setSelectedFloor(value as number)
      } else {
        setSelectedFloor(null)
      }
    }
  }

  const targetCapacity = metrics?.targetCapacity || 80
  const utilization = metrics?.currentUtilization || 0
  const isOverTarget = utilization > targetCapacity
  const isNearTarget = utilization > targetCapacity * 0.9

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="Target capacity and utilization metrics with detailed analytics"
      >
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </PageHeader>

      {/* Filter Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter performance metrics by different criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "All Warehouse", filter: "all" as FilterType },
              { label: "Floor 1", filter: "floor" as FilterType, value: 1 },
              { label: "Floor 2", filter: "floor" as FilterType, value: 2 },
              { label: "Floor 3", filter: "floor" as FilterType, value: 3 },
              { label: "Customer", filter: "customer" as FilterType },
              { label: "Broker", filter: "broker" as FilterType },
              { label: "Customer Groups", filter: "customer_group" as FilterType },
            ].map(({ label, filter, value }) => {
              const isActive = activeFilter === filter && (filter === "floor" ? selectedFloor === value : filterValue === value)

              return (
                <Badge
                  key={label}
                  variant={isActive ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer px-3 py-1",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => handleFilterClick(filter, value)}
                >
                  {label}
                </Badge>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : metrics ? (
        <>
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Target Capacity"
              value={`${targetCapacity}%`}
              icon={Target}
              subtitle="Configured target"
            />
            <StatCard
              title="Current Utilization"
              value={`${utilization.toFixed(1)}%`}
              icon={TrendingUp}
              subtitle={isOverTarget ? "Over target" : isNearTarget ? "Near target" : "Below target"}
              trend={{
                value: Math.abs(utilization - targetCapacity),
                isPositive: !isOverTarget,
              }}
            />
            <StatCard
              title="Total Capacity"
              value={formatNumber(metrics.totalCapacity)}
              icon={LineChart}
              subtitle="sq ft"
            />
            <StatCard
              title="Available"
              value={formatNumber(metrics.availableCapacity)}
              icon={LineChart}
              subtitle="sq ft"
            />
          </div>

          {/* Detailed Metrics */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Capacity Overview</CardTitle>
                <CardDescription>Current capacity breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Capacity</span>
                    <span className="font-medium">{formatNumber(metrics.totalCapacity)} sq ft</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Occupied</span>
                    <span className="font-medium text-orange-600">
                      {formatNumber(metrics.occupiedCapacity)} sq ft
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Available</span>
                    <span className="font-medium text-green-600">
                      {formatNumber(metrics.availableCapacity)} sq ft
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Utilization</span>
                      <span
                        className={cn(
                          "text-lg font-bold",
                          isOverTarget ? "text-destructive" : isNearTarget ? "text-amber-600" : "text-green-600"
                        )}
                      >
                        {utilization.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          isOverTarget ? "bg-destructive" : isNearTarget ? "bg-amber-500" : "bg-green-500"
                        )}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Target vs Actual</CardTitle>
                <CardDescription>Performance against target</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Target Capacity</span>
                    <span className="font-medium">{targetCapacity}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Utilization</span>
                    <span
                      className={cn(
                        "font-medium",
                        isOverTarget ? "text-destructive" : "text-green-600"
                      )}
                    >
                      {utilization.toFixed(1)}%
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Difference</span>
                      <span
                        className={cn(
                          "text-lg font-bold",
                          isOverTarget ? "text-destructive" : "text-green-600"
                        )}
                      >
                        {isOverTarget ? "+" : ""}
                        {(utilization - targetCapacity).toFixed(1)}%
                      </span>
                    </div>
                    {isOverTarget && (
                      <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-md text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span>Utilization exceeds target capacity</span>
                      </div>
                    )}
                    {isNearTarget && !isOverTarget && (
                      <div className="flex items-center gap-2 p-2 bg-amber-100 dark:bg-amber-900/30 rounded-md text-sm text-amber-700 dark:text-amber-400">
                        <AlertCircle className="h-4 w-4" />
                        <span>Utilization approaching target capacity</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Menu Item Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Sidebar Preview</CardTitle>
              <CardDescription>How this appears in the sidebar menu</CardDescription>
            </CardHeader>
            <CardContent>
              <PerformanceMenuItem />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No performance data available
          </CardContent>
        </Card>
      )}
    </div>
  )
}

