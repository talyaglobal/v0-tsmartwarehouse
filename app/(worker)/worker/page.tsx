import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { PriorityBadge } from "@/components/ui/status-badge"
import { ClipboardList, ArrowRight, Timer, Package, Truck } from "@/components/icons"
import { mockTasks, mockShifts } from "@/lib/mock-data"

export default function WorkerHomePage() {
  const todayTasks = mockTasks
  const completedToday = todayTasks.filter((t) => t.status === "completed").length
  const pendingTasks = todayTasks.filter((t) => t.status === "pending" || t.status === "assigned")
  const currentShift = mockShifts[0]

  return (
    <div className="p-4 space-y-4">
      {/* Shift Status */}
      <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm opacity-80">Current Shift</p>
              <p className="text-2xl font-bold">8h 30m</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
              <Timer className="h-6 w-6" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="opacity-80">Check-in:</span> 6:00 AM
            </div>
            <div>
              <span className="opacity-80">Tasks:</span> {completedToday}/{todayTasks.length}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Today's Progress</span>
            <Badge variant="secondary">{Math.round((completedToday / todayTasks.length) * 100)}%</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={(completedToday / todayTasks.length) * 100} className="h-2 mb-4" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-muted rounded-lg">
              <p className="text-lg font-bold">{pendingTasks.length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="p-2 bg-muted rounded-lg">
              <p className="text-lg font-bold">{todayTasks.filter((t) => t.status === "in-progress").length}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div className="p-2 bg-muted rounded-lg">
              <p className="text-lg font-bold text-green-600">{completedToday}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/worker/scan">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="pt-6 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <p className="font-medium">Scan Pallet</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/worker/tasks">
          <Card className="hover:border-primary transition-colors cursor-pointer">
            <CardContent className="pt-6 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <p className="font-medium">View Tasks</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Pending Tasks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Pending Tasks</CardTitle>
          <Link href="/worker/tasks">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              See All <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingTasks.slice(0, 3).map((task) => (
            <Link key={task.id} href={`/worker/tasks/${task.id}`}>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      task.type === "receiving"
                        ? "bg-blue-100 text-blue-600"
                        : task.type === "putaway"
                          ? "bg-green-100 text-green-600"
                          : task.type === "picking"
                            ? "bg-amber-100 text-amber-600"
                            : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {task.type === "receiving" ? (
                      <Truck className="h-5 w-5" />
                    ) : task.type === "putaway" ? (
                      <Package className="h-5 w-5" />
                    ) : (
                      <ClipboardList className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.zone}</p>
                  </div>
                </div>
                <PriorityBadge priority={task.priority} />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
