"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Users, Search, MoreHorizontal, Clock, CheckCircle, Plus, UserCheck, Loader2 } from "@/components/icons"
import type { User, Task } from "@/types"

export default function WorkersPage() {
  const [search, setSearch] = useState("")
  const [workers, setWorkers] = useState<User[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkers()
  }, [])

  const fetchWorkers = async () => {
    try {
      setLoading(true)
      // Fetch workers and their tasks
      const [workersRes, tasksRes] = await Promise.all([
        fetch('/api/v1/users?role=worker'),
        fetch('/api/v1/tasks'),
      ])

      if (workersRes.ok) {
        const workersData = await workersRes.json()
        setWorkers(workersData.data || [])
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setTasks(tasksData.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch workers:', error)
      setWorkers([])
    } finally {
      setLoading(false)
    }
  }

  const getWorkerStats = (workerId: string) => {
    const workerTasks = tasks.filter((t) => t.assignedTo === workerId)
    const completedTasks = workerTasks.filter((t) => t.status === "completed").length
    // Note: Shifts would need a separate API call
    return { shifts: 0, completedTasks, totalHours: 0 }
  }

  const isOnShift = (_workerId: string) => {
    // Note: This would need to check worker_shifts table
    return false
  }

  const filteredWorkers = workers.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.email.toLowerCase().includes(search.toLowerCase())
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
      <PageHeader
        title="Workers"
        description="Manage warehouse staff and schedules"
      >
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Worker
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Workers" value="12" icon={Users} />
        <StatCard title="On Shift Now" value="8" icon={UserCheck} subtitle="Currently working" />
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
              {filteredWorkers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No workers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkers.map((worker) => {
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
              })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
