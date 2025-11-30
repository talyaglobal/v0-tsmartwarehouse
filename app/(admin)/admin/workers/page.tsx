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
import { Users, Search, MoreHorizontal, Clock, CheckCircle, Plus, UserCheck } from "@/components/icons"
import { mockUsers, mockShifts, mockTasks } from "@/lib/mock-data"

export default function WorkersPage() {
  const [search, setSearch] = useState("")
  const workers = mockUsers.filter((u) => u.role === "worker")

  const getWorkerStats = (workerId: string) => {
    const shifts = mockShifts.filter((s) => s.workerId === workerId)
    const tasks = mockTasks.filter((t) => t.assignedTo === workerId)
    const completedTasks = tasks.filter((t) => t.status === "completed").length
    const totalHours = shifts.reduce((sum, s) => sum + (s.hoursWorked || 0), 0)
    return { shifts: shifts.length, completedTasks, totalHours }
  }

  const isOnShift = (workerId: string) => {
    return mockShifts.some((s) => s.workerId === workerId && !s.checkOutTime)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers"
        description="Manage warehouse staff and schedules"
        action={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Worker
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Workers" value="12" icon={Users} />
        <StatCard title="On Shift Now" value="8" icon={UserCheck} description="Currently working" />
        <StatCard title="Tasks Today" value="24" icon={CheckCircle} />
        <StatCard title="Avg Hours/Week" value="38.5" icon={Clock} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Worker Directory</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search workers..."
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
                <TableHead>Worker</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tasks Completed</TableHead>
                <TableHead>Hours This Week</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((worker) => {
                const stats = getWorkerStats(worker.id)
                const onShift = isOnShift(worker.id)
                return (
                  <TableRow key={worker.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                          {worker.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{worker.name}</p>
                          <p className="text-sm text-muted-foreground">{worker.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={onShift ? "default" : "secondary"}>{onShift ? "On Shift" : "Off Duty"}</Badge>
                    </TableCell>
                    <TableCell>{stats.completedTasks} tasks</TableCell>
                    <TableCell>{stats.totalHours.toFixed(1)} hrs</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{worker.phone}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Profile</DropdownMenuItem>
                          <DropdownMenuItem>View Schedule</DropdownMenuItem>
                          <DropdownMenuItem>Assign Task</DropdownMenuItem>
                          <DropdownMenuItem>View Performance</DropdownMenuItem>
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
