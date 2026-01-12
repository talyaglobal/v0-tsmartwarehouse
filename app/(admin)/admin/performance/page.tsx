"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Target, Download, Loader2, AlertCircle,
  CheckCircle, Clock, Package, Building2
} from "@/components/icons"
import { formatNumber } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface PerformanceData {
  overview: {
    targetUtilization: number
    currentUtilization: number
    totalCapacity: number
    usedCapacity: number
    availableCapacity: number
  }
  bookingMetrics: {
    totalBookings: number
    confirmedBookings: number
    pendingBookings: number
    averageProcessingTime: number // in hours
    confirmationRate: number
  }
  warehousePerformance: Array<{
    id: string
    name: string
    city: string
    utilization: number
    bookingCount: number
    status: boolean
  }>
}

export default function PerformancePage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PerformanceData | null>(null)

  useEffect(() => {
    fetchPerformanceData()
  }, [])

  const fetchPerformanceData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/admin/performance')
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch performance data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getUtilizationColor = (current: number, target: number) => {
    if (current > target) return "text-red-600"
    if (current > target * 0.9) return "text-amber-600"
    return "text-green-600"
  }

  const getUtilizationStatus = (current: number, target: number) => {
    if (current > target) return { label: "Over Target", variant: "destructive" as const }
    if (current > target * 0.9) return { label: "Near Target", variant: "outline" as const }
    return { label: "On Track", variant: "secondary" as const }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Analytics"
        description="Monitor warehouse performance and operational metrics"
      >
        <Button variant="outline" onClick={fetchPerformanceData}>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* Target vs Actual */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Utilization Target
                </CardTitle>
                <CardDescription>Current performance against target</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={cn(
                        "text-4xl font-bold",
                        getUtilizationColor(data.overview.currentUtilization, data.overview.targetUtilization)
                      )}>
                        {data.overview.currentUtilization.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground ml-2">/ {data.overview.targetUtilization}% target</span>
                    </div>
                    <Badge {...getUtilizationStatus(data.overview.currentUtilization, data.overview.targetUtilization)}>
                      {getUtilizationStatus(data.overview.currentUtilization, data.overview.targetUtilization).label}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <Progress 
                      value={data.overview.currentUtilization} 
                      className={cn(
                        "h-3",
                        data.overview.currentUtilization > data.overview.targetUtilization && "[&>div]:bg-red-500",
                        data.overview.currentUtilization > data.overview.targetUtilization * 0.9 && 
                        data.overview.currentUtilization <= data.overview.targetUtilization && "[&>div]:bg-amber-500"
                      )}
                    />
                    <div className="relative">
                      <div 
                        className="absolute w-0.5 h-4 bg-primary -top-1"
                        style={{ left: `${data.overview.targetUtilization}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-semibold">{formatNumber(data.overview.totalCapacity)} sq ft</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Used</p>
                      <p className="font-semibold text-orange-600">{formatNumber(data.overview.usedCapacity)} sq ft</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="font-semibold text-green-600">{formatNumber(data.overview.availableCapacity)} sq ft</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Booking Performance
                </CardTitle>
                <CardDescription>Booking processing metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Confirmation Rate
                      </div>
                      <p className="text-2xl font-bold text-green-600 mt-1">
                        {data.bookingMetrics.confirmationRate.toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Clock className="h-4 w-4 text-blue-600" />
                        Avg. Processing
                      </div>
                      <p className="text-2xl font-bold text-blue-600 mt-1">
                        {data.bookingMetrics.averageProcessingTime.toFixed(1)}h
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-semibold">{formatNumber(data.bookingMetrics.totalBookings)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Confirmed</p>
                      <p className="font-semibold text-green-600">{formatNumber(data.bookingMetrics.confirmedBookings)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <p className="font-semibold text-amber-600">{formatNumber(data.bookingMetrics.pendingBookings)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Warehouse Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Warehouse Performance
              </CardTitle>
              <CardDescription>Individual warehouse performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {data.warehousePerformance.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.warehousePerformance.map((warehouse) => (
                      <TableRow key={warehouse.id}>
                        <TableCell className="font-medium">{warehouse.name}</TableCell>
                        <TableCell className="text-muted-foreground">{warehouse.city}</TableCell>
                        <TableCell>
                          {warehouse.status ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-200">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={warehouse.utilization} 
                              className={cn("w-24 h-2", warehouse.utilization >= 90 && "[&>div]:bg-red-500")}
                            />
                            <span className={cn(
                              "text-sm font-medium",
                              warehouse.utilization >= 90 ? "text-red-600" : 
                              warehouse.utilization >= 70 ? "text-amber-600" : "text-green-600"
                            )}>
                              {warehouse.utilization.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(warehouse.bookingCount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No warehouse performance data available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Performance Alerts */}
          {data.overview.currentUtilization > data.overview.targetUtilization && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      Utilization exceeds target capacity
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-500">
                      Current utilization ({data.overview.currentUtilization.toFixed(1)}%) is above the target ({data.overview.targetUtilization}%). 
                      Consider expanding capacity or optimizing space allocation.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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
