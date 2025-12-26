"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { PriorityBadge, StatusBadge } from "@/components/ui/status-badge"
import { ArrowLeft, MapPin, Clock, Package, CheckCircle, Play, Loader2 } from "@/components/icons"
import { formatDateTime } from "@/lib/utils/format"
import type { Task } from "@/types"

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState("")
  const [task, setTask] = useState<Task | null>(null)

  useEffect(() => {
    fetchTask()
  }, [params.id])

  const fetchTask = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/tasks/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setTask(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch task:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartTask = async () => {
    if (!task) return
    setIsLoading(true)
    try {
      const response = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in-progress' }),
      })
      if (response.ok) {
        await fetchTask()
      }
    } catch (error) {
      console.error('Failed to start task:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompleteTask = async () => {
    if (!task) return
    setIsLoading(true)
    try {
      const response = await fetch(`/api/v1/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (response.ok) {
        router.push("/warehouse/tasks")
      }
    } catch (error) {
      console.error('Failed to complete task:', error)
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Task not found</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Task Details</h1>
        <StatusBadge status={task.status} />
      </div>

      {/* Task Info */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold">{task.title}</h2>
              <Badge variant="outline" className="mt-1 capitalize">
                {task.type}
              </Badge>
            </div>
            <PriorityBadge priority={task.priority} />
          </div>

          <p className="text-muted-foreground">{task.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MapPin className="h-4 w-4" />
                <span className="text-xs">Location</span>
              </div>
              <p className="font-medium">{task.zone}</p>
              {task.location && <p className="text-xs text-muted-foreground">{task.location}</p>}
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Due</span>
              </div>
              <p className="font-medium">{task.dueDate ? formatDateTime(task.dueDate) : "No deadline"}</p>
            </div>
          </div>

          {task.bookingId && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Related Booking</span>
              </div>
              <p className="text-sm text-muted-foreground">{task.bookingId}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Add notes about this task..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        {task.status === "pending" || task.status === "assigned" ? (
          <Button className="flex-1 gap-2" onClick={handleStartTask} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start Task
          </Button>
        ) : task.status === "in-progress" ? (
          <Button className="flex-1 gap-2" onClick={handleCompleteTask} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Complete Task
          </Button>
        ) : (
          <Button className="flex-1" variant="secondary" disabled>
            Task Completed
          </Button>
        )}
      </div>
    </div>
  )
}
