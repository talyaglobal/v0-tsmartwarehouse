"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PriorityBadge, StatusBadge } from "@/components/ui/status-badge"
import { ClipboardList, Truck, Package, Clock, MapPin, Wifi, WifiOff } from "@/components/icons"
import { useRealtimeTasks } from "@/lib/realtime"
import { useUser } from "@/lib/hooks/use-user"
import { formatDateTime } from "@/lib/utils/format"
import type { TaskStatus } from "@/types"

export default function WorkerTasksPage() {
  const [filter, setFilter] = useState<"all" | TaskStatus>("all")
  const { user } = useUser()
  const { tasks, isConnected, error } = useRealtimeTasks(user?.id)

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks
    return tasks.filter((t) => t.status === filter)
  }, [tasks, filter])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">My Tasks</h1>
          {isConnected ? (
            <span title="Real-time connected">
              <Wifi className="h-4 w-4 text-green-500" />
            </span>
          ) : (
            <span title="Real-time disconnected">
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            </span>
          )}
        </div>
        <Badge variant="secondary">{tasks.length} Total</Badge>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="in-progress">Active</TabsTrigger>
          <TabsTrigger value="completed">Done</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {filteredTasks.map((task) => (
          <Link key={task.id} href={`/worker/tasks/${task.id}`}>
            <Card className="hover:border-primary transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
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
                        <Truck className="h-4 w-4" />
                      ) : task.type === "putaway" ? (
                        <Package className="h-4 w-4" />
                      ) : (
                        <ClipboardList className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{task.type}</p>
                    </div>
                  </div>
                  <PriorityBadge priority={task.priority} />
                </div>

                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {task.zone}
                    </span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(task.dueDate)}
                      </span>
                    )}
                  </div>
                  <StatusBadge status={task.status} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {filteredTasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No tasks found</p>
          </div>
        )}
      </div>
    </div>
  )
}
