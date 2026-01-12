"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  FileText, Download, Loader2, Calendar, Users, 
  Package, Building2, DollarSign, Clock
} from "@/components/icons"
import { formatNumber, formatCurrency } from "@/lib/utils/format"
import { useToast } from "@/lib/hooks/use-toast"

interface ReportData {
  summary: {
    totalBookings: number
    confirmedBookings: number
    pendingBookings: number
    cancelledBookings: number
    totalRevenue: number
    totalUsers: number
    activeWarehouses: number
    totalCompanies: number
  }
  periodComparison: {
    bookingsChange: number
    revenueChange: number
    usersChange: number
  }
}

const REPORT_TYPES = [
  { 
    id: "overview", 
    name: "Overview Report", 
    description: "General summary of all metrics",
    icon: FileText 
  },
  { 
    id: "bookings", 
    name: "Bookings Report", 
    description: "Detailed booking statistics",
    icon: Package 
  },
  { 
    id: "revenue", 
    name: "Revenue Report", 
    description: "Financial performance analysis",
    icon: DollarSign 
  },
  { 
    id: "warehouses", 
    name: "Warehouses Report", 
    description: "Warehouse utilization and performance",
    icon: Building2 
  },
  { 
    id: "users", 
    name: "Users Report", 
    description: "User activity and growth",
    icon: Users 
  },
]

export default function ReportsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [data, setData] = useState<ReportData | null>(null)
  const [period, setPeriod] = useState("30")

  useEffect(() => {
    fetchReportData()
  }, [period])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/admin/reports?period=${period}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch report data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async (reportId: string) => {
    setGenerating(reportId)
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    toast({
      title: "Report Generated",
      description: `${REPORT_TYPES.find(r => r.id === reportId)?.name} has been generated successfully.`,
    })
    
    setGenerating(null)
  }

  const getChangeBadge = (value: number) => {
    if (value > 0) return "bg-green-100 text-green-700 border-green-200"
    if (value < 0) return "bg-red-100 text-red-700 border-red-200"
    return "bg-muted text-muted-foreground"
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and download reports for your warehouse operations"
      >
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bookings</p>
                    <p className="text-2xl font-bold">{formatNumber(data.summary.totalBookings)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                {data.periodComparison.bookingsChange !== 0 && (
                  <Badge className={getChangeBadge(data.periodComparison.bookingsChange)}>
                    {data.periodComparison.bookingsChange > 0 ? "+" : ""}
                    {data.periodComparison.bookingsChange.toFixed(1)}% vs previous
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(data.summary.totalRevenue)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
                {data.periodComparison.revenueChange !== 0 && (
                  <Badge className={getChangeBadge(data.periodComparison.revenueChange)}>
                    {data.periodComparison.revenueChange > 0 ? "+" : ""}
                    {data.periodComparison.revenueChange.toFixed(1)}% vs previous
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Warehouses</p>
                    <p className="text-2xl font-bold">{data.summary.activeWarehouses}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <Building2 className="h-5 w-5 text-violet-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{formatNumber(data.summary.totalUsers)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Users className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
                {data.periodComparison.usersChange !== 0 && (
                  <Badge className={getChangeBadge(data.periodComparison.usersChange)}>
                    {data.periodComparison.usersChange > 0 ? "+" : ""}
                    {data.periodComparison.usersChange.toFixed(1)}% new users
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Status Overview</CardTitle>
              <CardDescription>Breakdown of bookings by status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-green-700 dark:text-green-400">Confirmed</p>
                    <Badge className="bg-green-100 text-green-700">
                      {data.summary.totalBookings > 0 
                        ? ((data.summary.confirmedBookings / data.summary.totalBookings) * 100).toFixed(0) 
                        : 0}%
                    </Badge>
                  </div>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400 mt-2">
                    {formatNumber(data.summary.confirmedBookings)}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-amber-700 dark:text-amber-400">Pending</p>
                    <Badge className="bg-amber-100 text-amber-700">
                      {data.summary.totalBookings > 0 
                        ? ((data.summary.pendingBookings / data.summary.totalBookings) * 100).toFixed(0) 
                        : 0}%
                    </Badge>
                  </div>
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-400 mt-2">
                    {formatNumber(data.summary.pendingBookings)}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-red-700 dark:text-red-400">Cancelled</p>
                    <Badge className="bg-red-100 text-red-700">
                      {data.summary.totalBookings > 0 
                        ? ((data.summary.cancelledBookings / data.summary.totalBookings) * 100).toFixed(0) 
                        : 0}%
                    </Badge>
                  </div>
                  <p className="text-3xl font-bold text-red-700 dark:text-red-400 mt-2">
                    {formatNumber(data.summary.cancelledBookings)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Generate Reports</CardTitle>
              <CardDescription>Download detailed reports for analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {REPORT_TYPES.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <report.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{report.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {report.description}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          onClick={() => handleGenerateReport(report.id)}
                          disabled={generating === report.id}
                        >
                          {generating === report.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Generate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Summary Statistics
              </CardTitle>
              <CardDescription>Key metrics for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Average Booking Value</span>
                    <span className="font-semibold">
                      {data.summary.totalBookings > 0 
                        ? formatCurrency(data.summary.totalRevenue / data.summary.totalBookings)
                        : formatCurrency(0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Booking Success Rate</span>
                    <span className="font-semibold text-green-600">
                      {data.summary.totalBookings > 0 
                        ? ((data.summary.confirmedBookings / data.summary.totalBookings) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Total Companies</span>
                    <span className="font-semibold">{formatNumber(data.summary.totalCompanies)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">Cancellation Rate</span>
                    <span className="font-semibold text-red-600">
                      {data.summary.totalBookings > 0 
                        ? ((data.summary.cancelledBookings / data.summary.totalBookings) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No report data available
          </CardContent>
        </Card>
      )}
    </div>
  )
}
