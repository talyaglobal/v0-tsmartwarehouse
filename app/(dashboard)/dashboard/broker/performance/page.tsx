"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Award, Loader2 } from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"

type PerformanceMetric = {
  label: string
  value: number | string
  change?: number
  changeLabel?: string
  icon: React.ReactNode
}

export default function BrokerPerformancePage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("month")
  const [stats, setStats] = useState({
    totalLeads: 0,
    convertedLeads: 0,
    totalRevenue: 0,
    avgDealSize: 0,
    conversionRate: 0,
    commissionsEarned: 0,
    leadsThisPeriod: 0,
    dealsClosedThisPeriod: 0,
  })

  useEffect(() => {
    fetchPerformanceData()
  }, [period])

  const fetchPerformanceData = async () => {
    try {
      setLoading(true)
      // In production, fetch from API with period filter
      // const response = await api.get(`/api/v1/crm/metrics/team?period=${period}`)
      
      // Simulated data for now
      setTimeout(() => {
        setStats({
          totalLeads: 0,
          convertedLeads: 0,
          totalRevenue: 0,
          avgDealSize: 0,
          conversionRate: 0,
          commissionsEarned: 0,
          leadsThisPeriod: 0,
          dealsClosedThisPeriod: 0,
        })
        setLoading(false)
      }, 500)
    } catch (error) {
      console.error("Failed to fetch performance data:", error)
      setLoading(false)
    }
  }

  const metrics: PerformanceMetric[] = [
    {
      label: "Total Leads",
      value: stats.totalLeads,
      change: 12,
      changeLabel: "vs last period",
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Conversion Rate",
      value: `${stats.conversionRate}%`,
      change: 5,
      changeLabel: "vs last period",
      icon: <Target className="h-4 w-4" />,
    },
    {
      label: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      change: 23,
      changeLabel: "vs last period",
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      label: "Commissions Earned",
      value: formatCurrency(stats.commissionsEarned),
      change: 18,
      changeLabel: "vs last period",
      icon: <Award className="h-4 w-4" />,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
          <p className="text-muted-foreground">
            Track your sales performance and commissions
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                {metric.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              {metric.change !== undefined && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  {metric.change >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span className={metric.change >= 0 ? "text-green-500" : "text-red-500"}>
                    {metric.change >= 0 ? "+" : ""}{metric.change}%
                  </span>
                  {metric.changeLabel}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Pipeline</CardTitle>
            <CardDescription>Your current pipeline status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">New Leads</span>
                <Badge variant="secondary">0</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Qualified</span>
                <Badge variant="secondary">0</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Proposal Sent</span>
                <Badge variant="secondary">0</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Negotiation</span>
                <Badge variant="secondary">0</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Won</span>
                <Badge className="bg-green-100 text-green-700">0</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commission Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Commission Breakdown</CardTitle>
            <CardDescription>Your earnings this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium">Total Deals</span>
                <span className="font-bold">{stats.dealsClosedThisPeriod}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium">Total Deal Value</span>
                <span className="font-bold">{formatCurrency(stats.totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium">Average Deal Size</span>
                <span className="font-bold">{formatCurrency(stats.avgDealSize)}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-medium text-primary">Commission Earned</span>
                <span className="font-bold text-primary">{formatCurrency(stats.commissionsEarned)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals & Targets */}
      <Card>
        <CardHeader>
          <CardTitle>Goals & Targets</CardTitle>
          <CardDescription>Track your progress towards your targets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Monthly Lead Target</span>
                <span className="text-sm text-muted-foreground">0 / 20</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "0%" }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Monthly Revenue Target</span>
                <span className="text-sm text-muted-foreground">$0 / $50,000</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "0%" }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Monthly Commission Target</span>
                <span className="text-sm text-muted-foreground">$0 / $5,000</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "0%" }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
