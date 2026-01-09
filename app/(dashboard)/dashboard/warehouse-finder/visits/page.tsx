"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, Calendar, Loader2, MapPin, Building2 } from "@/components/icons"
import { api } from "@/lib/api/client"
import { formatDate } from "@/lib/utils/format"
import { ActivityTimeline } from "@/components/crm/ActivityTimeline"
import type { CRMActivity } from "@/types"

export default function WarehouseFinderVisitsPage() {
  const [visits, setVisits] = useState<CRMActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchVisits()
  }, [])

  const fetchVisits = async () => {
    try {
      setLoading(true)
      const result = await api.get<CRMActivity[]>("/api/v1/crm/activities?activity_type=visit")
      if (result.success) {
        setVisits(result.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch visits:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredVisits = visits.filter((v) =>
    v.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

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
          <h1 className="text-2xl font-bold tracking-tight">Warehouse Visits</h1>
          <p className="text-muted-foreground">
            Track and manage your warehouse visits
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Visit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search visits..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Badge variant="outline">
              {filteredVisits.length} visits
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filteredVisits.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No visits scheduled</p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Schedule First Visit
              </Button>
            </div>
          ) : (
            <ActivityTimeline activities={filteredVisits} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
