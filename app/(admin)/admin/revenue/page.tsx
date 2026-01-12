"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  TrendingUp, DollarSign, Download, Loader2, Calendar, 
  ArrowUpRight, ArrowDownRight, Building2, Package
} from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"

interface RevenueStats {
  totalRevenue: number
  monthlyRevenue: number
  weeklyRevenue: number
  averageBookingValue: number
  revenueGrowth: number
  topWarehouses: Array<{
    id: string
    name: string
    revenue: number
    bookingCount: number
  }>
  revenueByMonth: Array<{
    month: string
    revenue: number
    bookings: number
  }>
}

export default function RevenuePage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<RevenueStats | null>(null)
  const [period, setPeriod] = useState("30")

  useEffect(() => {
    fetchRevenueData()
  }, [period])

  const fetchRevenueData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/admin/revenue?period=${period}`)
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error("Failed to fetch revenue data:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Analytics"
        description="Track revenue performance and financial metrics"
      >
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          {/* Revenue Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  </div>
                </div>
                {stats.revenueGrowth !== 0 && (
                  <div className="mt-4 flex items-center gap-2">
                    {stats.revenueGrowth > 0 ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        +{stats.revenueGrowth.toFixed(1)}%
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-red-200">
                        <ArrowDownRight className="h-3 w-3 mr-1" />
                        {stats.revenueGrowth.toFixed(1)}%
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">vs previous period</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                    <TrendingUp className="h-6 w-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Weekly Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(stats.weeklyRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                    <Package className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg. Booking Value</p>
                    <p className="text-2xl font-bold">{formatCurrency(stats.averageBookingValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Monthly Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Monthly revenue over time</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.revenueByMonth.length > 0 ? (
                  <div className="space-y-4">
                    {stats.revenueByMonth.map((item, index) => {
                      const maxRevenue = Math.max(...stats.revenueByMonth.map(r => r.revenue))
                      const percentage = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0
                      return (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.month}</span>
                            <span className="font-medium">{formatCurrency(item.revenue)}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.bookings} booking{item.bookings !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No revenue data available for this period
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Top Warehouses by Revenue */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Top Warehouses by Revenue
                </CardTitle>
                <CardDescription>Highest performing warehouses</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.topWarehouses.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Bookings</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.topWarehouses.map((warehouse, index) => (
                        <TableRow key={warehouse.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="w-6 h-6 rounded-full justify-center">
                                {index + 1}
                              </Badge>
                              <span className="font-medium">{warehouse.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(warehouse.revenue)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {warehouse.bookingCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No warehouse revenue data available
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No revenue data available
          </CardContent>
        </Card>
      )}
    </div>
  )
}
