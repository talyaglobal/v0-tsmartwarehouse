"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { Users, TrendingUp, DollarSign, Mail } from "@/components/icons"
import { ContactCard } from "@/components/crm/ContactCard"
import { ActivityTimeline } from "@/components/crm/ActivityTimeline"
import { api } from "@/lib/api/client"
import type { CRMContact, CRMActivity, PipelineOverview } from "@/types"
import Link from "next/link"

export default function ResellerDashboard() {
  const [leads, setLeads] = useState<CRMContact[]>([])
  const [activities, setActivities] = useState<CRMActivity[]>([])
  const [pipeline, setPipeline] = useState<PipelineOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeOpportunities: 0,
    outreachThisMonth: 0,
    conversionRate: 0,
    avgDealSize: 0,
    pipelineValue: 0,
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [leadsRes, activitiesRes, pipelineRes] = await Promise.all([
        api.get<CRMContact[]>("/api/v1/crm/contacts?contact_type=customer_lead&status=active&limit=5"),
        api.get<CRMActivity[]>("/api/v1/crm/activities?limit=10"),
        api.get<PipelineOverview[]>("/api/v1/crm/pipeline?contact_type=customer_lead"),
      ])

      if (leadsRes.success) setLeads(leadsRes.data || [])
      if (activitiesRes.success) setActivities(activitiesRes.data || [])
      if (pipelineRes.success) setPipeline(pipelineRes.data || [])

      // Calculate stats
      const totalLeads = leadsRes.success ? (leadsRes.data || []).length : 0
      const activeOpportunities = pipelineRes.success
        ? (pipelineRes.data || []).reduce((sum, stage) => sum + stage.contactCount, 0)
        : 0
      const outreachThisMonth = activitiesRes.success
        ? (activitiesRes.data || []).filter((a) => ["call", "email"].includes(a.activityType)).length
        : 0

      setStats({
        totalLeads,
        activeOpportunities,
        outreachThisMonth,
        conversionRate: 0,
        avgDealSize: 0,
        pipelineValue: 0,
      })
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reseller Dashboard</h1>
        <Link href="/dashboard/reseller/leads">
          <Button>
            <Users className="h-4 w-4 mr-2" />
            New Lead
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Total Leads" value={stats.totalLeads} icon={Users} />
        <StatCard title="Active Opportunities" value={stats.activeOpportunities} icon={TrendingUp} />
        <StatCard title="Outreach This Month" value={stats.outreachThisMonth} icon={Mail} />
        <StatCard title="Conversion Rate" value={`${stats.conversionRate}%`} icon={TrendingUp} />
        <StatCard title="Avg. Deal Size" value={`$${stats.avgDealSize}`} icon={DollarSign} />
        <StatCard title="Pipeline Value" value={`$${stats.pipelineValue}`} icon={DollarSign} />
      </div>

      {/* Pipeline Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            {pipeline.slice(0, 5).map((stage) => (
              <div key={stage.stage} className="text-center">
                <div className="text-2xl font-bold">{stage.contactCount}</div>
                <div className="text-xs text-muted-foreground">{stage.milestoneName}</div>
                <div className="text-xs text-muted-foreground">{stage.percentage}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leads.map((lead) => (
                <ContactCard key={lead.id} contact={lead} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimeline activities={activities} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

