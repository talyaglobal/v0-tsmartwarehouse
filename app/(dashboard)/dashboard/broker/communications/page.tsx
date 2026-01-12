"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Mail, Phone, MessageSquare, Loader2, Calendar, Clock } from "@/components/icons"
import { api } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/format"
import type { CRMActivity } from "@/types"

export default function BrokerCommunicationsPage() {
  const [activities, setActivities] = useState<CRMActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")

  useEffect(() => {
    fetchActivities()
  }, [])

  const fetchActivities = async () => {
    try {
      setLoading(true)
      const response = await api.get<CRMActivity[]>("/api/v1/crm/activities?limit=50")
      if (response.success) {
        setActivities(response.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'call':
        return <Phone className="h-4 w-4" />
      case 'meeting':
        return <Calendar className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getActivityBadge = (type: string) => {
    const typeConfig: Record<string, { label: string; className: string }> = {
      email: { label: "Email", className: "bg-blue-100 text-blue-700 border-blue-200" },
      call: { label: "Call", className: "bg-green-100 text-green-700 border-green-200" },
      meeting: { label: "Meeting", className: "bg-purple-100 text-purple-700 border-purple-200" },
      note: { label: "Note", className: "bg-gray-100 text-gray-700 border-gray-200" },
    }
    const config = typeConfig[type] || { label: type, className: "bg-gray-100 text-gray-700 border-gray-200" }
    return <Badge className={config.className}>{config.label}</Badge>
  }

  const filteredActivities = activities.filter((activity) => {
    const matchesSearch = 
      activity.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesType = typeFilter === "all" || activity.activityType === typeFilter
    
    return matchesSearch && matchesType
  })

  const todayActivities = filteredActivities.filter((a) => {
    const today = new Date()
    const activityDate = new Date(a.createdAt || '')
    return activityDate.toDateString() === today.toDateString()
  })

  const upcomingActivities = filteredActivities.filter((a) => {
    if (!a.taskDueDate) return false
    const now = new Date()
    const scheduled = new Date(a.taskDueDate)
    return scheduled > now
  })

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
          <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
          <p className="text-muted-foreground">
            Track all your communications with leads
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Phone className="h-4 w-4 mr-2" />
            Log Call
          </Button>
          <Button>
            <Mail className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{todayActivities.length}</div>
            <p className="text-sm text-muted-foreground">Today's Activities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {activities.filter(a => a.activityType === 'email').length}
            </div>
            <p className="text-sm text-muted-foreground">Emails Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {activities.filter(a => a.activityType === 'call').length}
            </div>
            <p className="text-sm text-muted-foreground">Calls Made</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{upcomingActivities.length}</div>
            <p className="text-sm text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search communications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Communications List */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            Your recent communications and scheduled activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No communications found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || typeFilter !== "all" 
                  ? "Try adjusting your search or filters"
                  : "Log your first communication to get started"}
              </p>
              {!searchQuery && typeFilter === "all" && (
                <div className="flex justify-center gap-2">
                  <Button variant="outline">
                    <Phone className="h-4 w-4 mr-2" />
                    Log Call
                  </Button>
                  <Button>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    {getActivityIcon(activity.activityType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getActivityBadge(activity.activityType)}
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {activity.createdAt ? formatDate(activity.createdAt) : "—"}
                      </span>
                    </div>
                    <p className="font-medium">{activity.subject || "No subject"}</p>
                    {activity.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {activity.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
