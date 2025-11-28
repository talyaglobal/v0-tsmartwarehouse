"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { cn } from "@/lib/utils"
import type { Task } from "@/types"
import { Clock, ChevronRight, Play, CheckCircle } from "lucide-react"
import { formatDate } from "@/lib/utils/format"
import Link from "next/link"

interface TaskCardProps {
  task: Task
  onStart?: () => void
  onComplete?: () => void
}

const taskTypeIcons: Record<string, string> = {
  receiving: "📦",
  putaway: "🏷️",
  picking: "🛒",
  packing: "📤",
  shipping: "🚚",
  inventory: "📋",
  maintenance: "🔧",
}

export function TaskCard({ task, onStart, onComplete }: TaskCardProps) {
  const isUrgent = task.priority === "urgent" || task.priority === "high"

  return (
    <Card className={cn("transition-all", isUrgent && task.status === "pending" && "border-l-4 border-l-red-500")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-lg">
              {taskTypeIcons[task.type] || "📋"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge type="priority" status={task.priority} />
                <StatusBadge type="task" status={task.status} />
              </div>
              <h3 className="font-medium truncate">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{task.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                {task.due_date && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(task.due_date, "MMM d, h:mm a")}
                  </span>
                )}
                {task.estimated_minutes && (
                  <span className="flex items-center gap-1">~{task.estimated_minutes}min</span>
                )}
              </div>
            </div>
          </div>
          <Link href={`/worker/tasks/${task.id}`}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Quick Actions */}
        {(task.status === "pending" || task.status === "in_progress") && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            {task.status === "pending" && (
              <Button size="sm" className="flex-1" onClick={onStart}>
                <Play className="mr-1 h-4 w-4" />
                Start Task
              </Button>
            )}
            {task.status === "in_progress" && (
              <Button size="sm" className="flex-1" variant="default" onClick={onComplete}>
                <CheckCircle className="mr-1 h-4 w-4" />
                Complete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
