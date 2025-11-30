"use client"

import { useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertCircle, Search, MoreHorizontal, AlertTriangle, CheckCircle, Clock, Plus } from "@/components/icons"
import { mockIncidents } from "@/lib/mock-data"
import { formatDate } from "@/lib/utils/format"
import type { IncidentSeverity, IncidentStatus } from "@/types"

const severityColors: Record<IncidentSeverity, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
}

const statusConfig: Record<IncidentStatus, { color: string; icon: typeof CheckCircle }> = {
  open: { color: "destructive", icon: AlertCircle },
  investigating: { color: "warning", icon: Clock },
  resolved: { color: "success", icon: CheckCircle },
  closed: { color: "secondary", icon: CheckCircle },
}

export default function IncidentsPage() {
  const [search, setSearch] = useState("")

  const openCount = mockIncidents.filter((i) => i.status === "open").length
  const investigatingCount = mockIncidents.filter((i) => i.status === "investigating").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Track and manage warehouse incidents"
        action={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Report Incident
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Open Incidents"
          value={openCount.toString()}
          icon={AlertCircle}
          description="Requires attention"
        />
        <StatCard title="Investigating" value={investigatingCount.toString()} icon={Clock} description="In progress" />
        <StatCard title="Resolved (30d)" value="8" icon={CheckCircle} description="This month" />
        <StatCard title="Avg Resolution" value="4.2 hrs" icon={AlertTriangle} description="Response time" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Incidents</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search incidents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockIncidents.map((incident) => {
                const StatusIcon = statusConfig[incident.status].icon
                return (
                  <TableRow key={incident.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{incident.title}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{incident.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {incident.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${severityColors[incident.severity]}`}
                      >
                        {incident.severity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusIcon className="h-4 w-4" />
                        <span className="capitalize">{incident.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>{incident.location || "-"}</TableCell>
                    <TableCell>{formatDate(incident.createdAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Update Status</DropdownMenuItem>
                          <DropdownMenuItem>Assign Investigator</DropdownMenuItem>
                          <DropdownMenuItem>Create Claim</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
