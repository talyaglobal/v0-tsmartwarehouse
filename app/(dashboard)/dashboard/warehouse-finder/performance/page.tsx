"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { TrendingUp, Calendar, Building2, Users } from "@/components/icons"
import type { CRMPerformanceMetrics } from "@/types"

export default function WarehouseFinderPerformancePage() {
  const [metrics, setMetrics] = useState<CRMPerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      // TODO: Replace with actual API endpoint when available
      // const result = await api.get<CRMPerformanceMetrics>("/api/v1/crm/performance")
      // if (result.success) {
      //   setMetrics(result.data)
      // }
      
      // Placeholder data
      setMetrics({
        id: "1",
        userId: "1",
        metricDate: new Date().toISOString(),
        metricMonth: new Date().toISOString().slice(0, 7),
        metricQuarter: "Q1",
        metricYear: 2024,
        contactsCreated: 0,
        callsMade: 0,
        emailsSent: 0,
        visitsConducted: 0,
        meetingsHeld: 0,
        contactsInPipeline: 0,
        contactsMovedForward: 0,
        contactsMovedBackward: 0,
        contactsConverted: 0,
        averagePipelineStage: 0,
        conversionRate: 0,
        averageDaysToConvert: 0,
        totalRevenueGenerated: 0,
        adminApprovalsRequested: 0,
        adminApprovalsGranted: 0,
        adminApprovalRate: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Failed to fetch metrics:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !metrics) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance Metrics</h1>
        <p className="text-muted-foreground">
          Track your warehouse finding performance and activities
        </p>
      </div>

      {/* Activity Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Contacts Created"
          value={metrics.contactsCreated}
          icon={Building2}
        />
        <StatCard
          title="Calls Made"
          value={metrics.callsMade}
          icon={TrendingUp}
        />
        <StatCard
          title="Emails Sent"
          value={metrics.emailsSent}
          icon={TrendingUp}
        />
        <StatCard
          title="Visits Conducted"
          value={metrics.visitsConducted}
          icon={Calendar}
        />
        <StatCard
          title="Meetings Held"
          value={metrics.meetingsHeld}
          icon={Users}
        />
      </div>

      {/* Pipeline Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{metrics.contactsInPipeline}</div>
              <div className="text-sm text-muted-foreground mt-1">Contacts in Pipeline</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{metrics.contactsMovedForward}</div>
              <div className="text-sm text-muted-foreground mt-1">Moved Forward</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{metrics.contactsConverted}</div>
              <div className="text-sm text-muted-foreground mt-1">Converted</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{(metrics.conversionRate ?? 0).toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground mt-1">Conversion Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue & Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">${(metrics.totalRevenueGenerated || 0).toLocaleString()}</div>
              <div className="text-sm text-muted-foreground mt-1">Total Revenue</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{metrics.averageDaysToConvert || 0}</div>
              <div className="text-sm text-muted-foreground mt-1">Avg. Days to Convert</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold">{(metrics.adminApprovalRate || 0).toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground mt-1">Approval Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
