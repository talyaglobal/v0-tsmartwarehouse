"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { WorkerHeader } from "@/components/worker/worker-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/ui/status-badge"
import { mockTasks, mockBookings, mockWarehouses } from "@/lib/mock-data"
import { formatDate } from "@/lib/utils/format"
import { ArrowLeft, Clock, MapPin, Package, Play, CheckCircle, Camera, AlertTriangle } from "lucide-react"

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [notes, setNotes] = React.useState("")
  const [status, setStatus] = React.useState<"pending" | "in_progress" | "completed">("pending")

  const task = mockTasks.find((t) => t.id === params.id)
  const booking = task?.booking_id ? mockBookings.find((b) => b.id === task.booking_id) : null
  const warehouse = task?.warehouse_id ? mockWarehouses.find((w) => w.id === task.warehouse_id) : null

  React.useEffect(() => {
    if (task) {
      setStatus(task.status as "pending" | "in_progress" | "completed")
    }
  }, [task])

  if (!task) {
    return (
      <div className="flex flex-col min-h-screen">
        <WorkerHeader title="Task Details" />
        <main className="flex-1 p-4 flex items-center justify-center">
          <p className="text-muted-foreground">Task not found</p>
        </main>
      </div>
    )
  }

  const handleStart = () => {
    setStatus("in_progress")
  }

  const handleComplete = () => {
    setStatus("completed")
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Task Details</h1>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4">
        {/* Task Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <StatusBadge type="priority" status={task.priority} />
                <StatusBadge type="task" status={status} />
              </div>
              <span className="text-xs text-muted-foreground capitalize">{task.type.replace("_", " ")}</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">{task.title}</h2>
            {task.description && <p className="text-muted-foreground">{task.description}</p>}
          </CardContent>
        </Card>

        {/* Task Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {task.due_date && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Due Date</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(task.due_date, "EEEE, MMM d, yyyy h:mm a")}
                  </p>
                </div>
              </div>
            )}
            {warehouse && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-sm text-muted-foreground">{warehouse.name}</p>
                </div>
              </div>
            )}
            {booking && (
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Related Booking</p>
                  <p className="text-sm text-muted-foreground">{booking.booking_number}</p>
                </div>
              </div>
            )}
            {task.estimated_minutes && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Estimated Time</p>
                  <p className="text-sm text-muted-foreground">{task.estimated_minutes} minutes</p>
                </div>
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
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-12 bg-transparent">
            <Camera className="mr-2 h-4 w-4" />
            Add Photo
          </Button>
          <Button variant="outline" className="h-12 bg-transparent">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Report Issue
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-20 bg-background pt-4 pb-2 space-y-2">
          {status === "pending" && (
            <Button className="w-full h-12" onClick={handleStart}>
              <Play className="mr-2 h-5 w-5" />
              Start Task
            </Button>
          )}
          {status === "in_progress" && (
            <Button className="w-full h-12" onClick={handleComplete}>
              <CheckCircle className="mr-2 h-5 w-5" />
              Complete Task
            </Button>
          )}
          {status === "completed" && (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
              <p className="font-medium text-emerald-600">Task Completed</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
