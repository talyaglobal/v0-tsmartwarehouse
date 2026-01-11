"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { Building2, MapPin, TrendingUp, Calendar } from "@/components/icons"
import { ContactCard } from "@/components/crm/ContactCard"
import { ActivityTimeline } from "@/components/crm/ActivityTimeline"
import { api } from "@/lib/api/client"
import type { CRMContact, CRMActivity, PipelineOverview } from "@/types"
import Link from "next/link"

export default function WarehouseFinderDashboard() {
  const [contacts, setContacts] = useState<CRMContact[]>([])
  const [activities, setActivities] = useState<CRMActivity[]>([])
  const [pipeline, setPipeline] = useState<PipelineOverview[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalContacts: 0,
    activePipeline: 0,
    visitsThisMonth: 0,
    conversionRate: 0,
    avgPipelineStage: 0,
    pendingApprovals: 0,
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [contactsRes, activitiesRes, pipelineRes] = await Promise.all([
        api.get<CRMContact[]>("/api/v1/crm/contacts?contact_type=warehouse_supplier&status=active&limit=5"),
        api.get<CRMActivity[]>("/api/v1/crm/activities?limit=10"),
        api.get<PipelineOverview[]>("/api/v1/crm/pipeline?contact_type=warehouse_supplier"),
      ])

      if (contactsRes.success) setContacts(contactsRes.data || [])
      if (activitiesRes.success) setActivities(activitiesRes.data || [])
      if (pipelineRes.success) setPipeline(pipelineRes.data || [])

      // Calculate stats
      const totalContacts = contactsRes.success ? (contactsRes.data || []).length : 0
      const activePipeline = pipelineRes.success
        ? (pipelineRes.data || []).reduce((sum, stage) => sum + stage.contactCount, 0)
        : 0
      const visitsThisMonth = activitiesRes.success
        ? (activitiesRes.data || []).filter((a) => a.activityType === "visit").length
        : 0

      setStats({
        totalContacts,
        activePipeline,
        visitsThisMonth,
        conversionRate: 0, // TODO: Calculate from metrics
        avgPipelineStage: 0, // TODO: Calculate from pipeline
        pendingApprovals: 0, // TODO: Fetch from contacts
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
        <h1 className="text-2xl font-bold">Warehouse Finder Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/warehouse-finder/map">
            <Button variant="outline">
              <MapPin className="h-4 w-4 mr-2" />
              Discover Warehouses
            </Button>
          </Link>
          <Link href="/dashboard/warehouse-finder/contacts">
            <Button>
              <Building2 className="h-4 w-4 mr-2" />
              New Contact
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Total Contacts" value={stats.totalContacts} icon={Building2} />
        <StatCard title="Active Pipeline" value={stats.activePipeline} icon={TrendingUp} />
        <StatCard title="Visits This Month" value={stats.visitsThisMonth} icon={Calendar} />
        <StatCard title="Conversion Rate" value={`${stats.conversionRate}%`} icon={TrendingUp} />
        <StatCard title="Avg. Stage" value={`${stats.avgPipelineStage}%`} icon={TrendingUp} />
        <StatCard title="Pending Approvals" value={stats.pendingApprovals} icon={Building2} />
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
        {/* Recent Contacts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contacts.map((contact) => (
                <ContactCard key={contact.id} contact={contact} />
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

