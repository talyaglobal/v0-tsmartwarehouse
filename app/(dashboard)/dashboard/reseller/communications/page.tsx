"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Search, Mail, Phone, MessageSquare, Loader2 } from "@/components/icons"
import { api } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/format"
import { ActivityTimeline } from "@/components/crm/ActivityTimeline"
import type { CRMActivity } from "@/types"

export default function ResellerCommunicationsPage() {
  const [activities, setActivities] = useState<CRMActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<"all" | "email" | "call">("all")

  useEffect(() => {
    fetchCommunications()
  }, [])

  const fetchCommunications = async () => {
    try {
      setLoading(true)
      const result = await api.get<CRMActivity[]>("/api/v1/crm/activities")
      if (result.success) {
        setActivities(result.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch communications:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredActivities = activities.filter((a) => {
    const matchesSearch =
      a.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesType =
      filterType === "all" ||
      (filterType === "email" && a.activityType === "email") ||
      (filterType === "call" && a.activityType === "call")
    
    return matchesSearch && matchesType
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
            Track all your customer communications
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search communications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Badge variant="outline">
              {filteredActivities.length} communications
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="email">
                <Mail className="h-4 w-4 mr-2" />
                Emails
              </TabsTrigger>
              <TabsTrigger value="call">
                <Phone className="h-4 w-4 mr-2" />
                Calls
              </TabsTrigger>
            </TabsList>
            <TabsContent value={filterType} className="mt-4">
              {filteredActivities.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No communications found</p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Start Communication
                  </Button>
                </div>
              ) : (
                <ActivityTimeline activities={filteredActivities} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
