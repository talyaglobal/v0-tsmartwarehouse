"use client"
import { WorkerHeader } from "@/components/worker/worker-header"
import { TaskCard } from "@/components/worker/task-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { mockTasks, mockWorkers } from "@/lib/mock-data"
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, ChevronRight, QrCode } from "lucide-react"
import Link from "next/link"

export default function WorkerHomePage() {
  const worker = mockWorkers[0]
  const myTasks = mockTasks.filter((t) => t.assigned_to === worker.id)
  const pendingTasks = myTasks.filter((t) => t.status === "pending")
  const inProgressTasks = myTasks.filter((t) => t.status === "in_progress")
  const completedToday = 3 // Mock value
  const totalAssigned = myTasks.length

  const urgentTasks = myTasks.filter(
    (t) => (t.priority === "urgent" || t.priority === "high") && t.status !== "completed",
  )

  return (
    <div className="flex flex-col min-h-screen">
      <WorkerHeader showGreeting workerName={worker.full_name.split(" ")[0]} />

      <main className="flex-1 p-4 space-y-4">
        {/* Today's Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today's Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tasks Completed</span>
                <span className="font-medium">
                  {completedToday} / {totalAssigned}
                </span>
              </div>
              <Progress value={(completedToday / totalAssigned) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <ClipboardList className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-xl font-bold">{pendingTasks.length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <p className="text-xl font-bold">{inProgressTasks.length}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
              <p className="text-xl font-bold">{completedToday}</p>
              <p className="text-xs text-muted-foreground">Done Today</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Scan Button */}
        <Link href="/worker/scan">
          <Button className="w-full h-14 text-base" size="lg">
            <QrCode className="mr-2 h-5 w-5" />
            Quick Scan
          </Button>
        </Link>

        {/* Urgent Tasks */}
        {urgentTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <h2 className="font-semibold">Urgent Tasks</h2>
            </div>
            {urgentTasks.slice(0, 2).map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}

        {/* Current Tasks */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">My Tasks</h2>
            <Link href="/worker/tasks">
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          {myTasks
            .filter((t) => t.status !== "completed")
            .slice(0, 3)
            .map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          {myTasks.filter((t) => t.status !== "completed").length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500 opacity-50" />
                <p className="text-muted-foreground">All tasks completed!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
