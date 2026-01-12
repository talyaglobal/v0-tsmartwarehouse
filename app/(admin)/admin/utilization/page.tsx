"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Download, Loader2, Warehouse, Package, 
  TrendingUp, TrendingDown, AlertCircle, CheckCircle
} from "@/components/icons"
import { formatNumber } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface UtilizationStats {
  overall: {
    totalSqFt: number
    usedSqFt: number
    availableSqFt: number
    sqFtUtilization: number
    totalPallets: number
    usedPallets: number
    availablePallets: number
    palletUtilization: number
  }
  warehouses: Array<{
    id: string
    name: string
    city: string
    totalSqFt: number
    availableSqFt: number
    sqFtUtilization: number
    totalPallets: number
    availablePallets: number
    palletUtilization: number
    status: boolean
  }>
  utilizationTrend: Array<{
    date: string
    sqFtUtilization: number
    palletUtilization: number
  }>
}

export default function UtilizationPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<UtilizationStats | null>(null)

  useEffect(() => {
    fetchUtilizationData()
  }, [])

  const fetchUtilizationData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/admin/utilization')
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error("Failed to fetch utilization data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-600"
    if (percentage >= 70) return "text-amber-600"
    return "text-green-600"
  }

  const getUtilizationBadge = (percentage: number) => {
    if (percentage >= 90) return { label: "Critical", variant: "destructive" as const }
    if (percentage >= 70) return { label: "High", variant: "outline" as const }
    if (percentage >= 50) return { label: "Medium", variant: "secondary" as const }
    return { label: "Low", variant: "outline" as const }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capacity Utilization"
        description="Monitor warehouse capacity and space utilization"
      >
        <Button variant="outline" onClick={fetchUtilizationData}>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          {/* Overall Utilization */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Warehouse className="h-5 w-5" />
                  Square Footage Utilization
                </CardTitle>
                <CardDescription>Overall space usage across all warehouses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-4xl font-bold", getUtilizationColor(stats.overall.sqFtUtilization))}>
                      {stats.overall.sqFtUtilization.toFixed(1)}%
                    </span>
                    <Badge {...getUtilizationBadge(stats.overall.sqFtUtilization)}>
                      {getUtilizationBadge(stats.overall.sqFtUtilization).label}
                    </Badge>
                  </div>
                  <Progress 
                    value={stats.overall.sqFtUtilization} 
                    className={cn("h-3", stats.overall.sqFtUtilization >= 90 && "[&>div]:bg-red-500", stats.overall.sqFtUtilization >= 70 && stats.overall.sqFtUtilization < 90 && "[&>div]:bg-amber-500")}
                  />
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-semibold">{formatNumber(stats.overall.totalSqFt)} sq ft</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Used</p>
                      <p className="font-semibold text-orange-600">{formatNumber(stats.overall.usedSqFt)} sq ft</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="font-semibold text-green-600">{formatNumber(stats.overall.availableSqFt)} sq ft</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Pallet Utilization
                </CardTitle>
                <CardDescription>Overall pallet storage usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-4xl font-bold", getUtilizationColor(stats.overall.palletUtilization))}>
                      {stats.overall.palletUtilization.toFixed(1)}%
                    </span>
                    <Badge {...getUtilizationBadge(stats.overall.palletUtilization)}>
                      {getUtilizationBadge(stats.overall.palletUtilization).label}
                    </Badge>
                  </div>
                  <Progress 
                    value={stats.overall.palletUtilization} 
                    className={cn("h-3", stats.overall.palletUtilization >= 90 && "[&>div]:bg-red-500", stats.overall.palletUtilization >= 70 && stats.overall.palletUtilization < 90 && "[&>div]:bg-amber-500")}
                  />
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-semibold">{formatNumber(stats.overall.totalPallets)} pallets</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Used</p>
                      <p className="font-semibold text-orange-600">{formatNumber(stats.overall.usedPallets)} pallets</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="font-semibold text-green-600">{formatNumber(stats.overall.availablePallets)} pallets</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Warehouses Table */}
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Breakdown</CardTitle>
              <CardDescription>Utilization by individual warehouse</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.warehouses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sq Ft Usage</TableHead>
                      <TableHead>Pallet Usage</TableHead>
                      <TableHead className="text-right">Overall</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.warehouses.map((warehouse) => {
                      const avgUtilization = (warehouse.sqFtUtilization + warehouse.palletUtilization) / 2
                      return (
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
                                value={warehouse.sqFtUtilization} 
                                className={cn("w-20 h-2", warehouse.sqFtUtilization >= 90 && "[&>div]:bg-red-500")}
                              />
                              <span className={cn("text-sm", getUtilizationColor(warehouse.sqFtUtilization))}>
                                {warehouse.sqFtUtilization.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={warehouse.palletUtilization} 
                                className={cn("w-20 h-2", warehouse.palletUtilization >= 90 && "[&>div]:bg-red-500")}
                              />
                              <span className={cn("text-sm", getUtilizationColor(warehouse.palletUtilization))}>
                                {warehouse.palletUtilization.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn("font-semibold", getUtilizationColor(avgUtilization))}>
                              {avgUtilization.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No warehouse data available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Utilization Insights */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-xl",
                    stats.warehouses.filter(w => w.sqFtUtilization >= 90 || w.palletUtilization >= 90).length > 0
                      ? "bg-red-100 dark:bg-red-900/30"
                      : "bg-green-100 dark:bg-green-900/30"
                  )}>
                    <AlertCircle className={cn(
                      "h-6 w-6",
                      stats.warehouses.filter(w => w.sqFtUtilization >= 90 || w.palletUtilization >= 90).length > 0
                        ? "text-red-600"
                        : "text-green-600"
                    )} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Critical Warehouses</p>
                    <p className="text-2xl font-bold">
                      {stats.warehouses.filter(w => w.sqFtUtilization >= 90 || w.palletUtilization >= 90).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                    <TrendingUp className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">High Utilization</p>
                    <p className="text-2xl font-bold">
                      {stats.warehouses.filter(w => (w.sqFtUtilization >= 70 && w.sqFtUtilization < 90) || (w.palletUtilization >= 70 && w.palletUtilization < 90)).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                    <TrendingDown className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Available Capacity</p>
                    <p className="text-2xl font-bold">
                      {stats.warehouses.filter(w => w.sqFtUtilization < 50 && w.palletUtilization < 50).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No utilization data available
          </CardContent>
        </Card>
      )}
    </div>
  )
}
