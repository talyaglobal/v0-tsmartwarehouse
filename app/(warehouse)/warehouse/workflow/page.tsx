"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Truck, 
  PackageCheck, 
  MapPin, 
  Phone, 
  Search,
  Package,
  BoxSelect,
  ClipboardCheck,
  Sparkles,
  Wrench,
  Tag,
  CheckCircle2,
  PlayCircle
} from "lucide-react"
import { useUser } from "@/lib/hooks/use-user"
import Link from "next/link"
import type { StaffTask } from "@/types"

// Workflow steps based on user requirements
const WORKFLOW_STEPS = [
  { code: "unload_goods", icon: Truck, label: "Unload Goods", description: "Unload incoming goods from transport" },
  { code: "acceptance", icon: PackageCheck, label: "Acceptance", description: "Accept and verify incoming goods" },
  { code: "placement", icon: MapPin, label: "Placement", description: "Place goods at warehouse location" },
  { code: "customer_contact", icon: Phone, label: "Customer Contact", description: "Contact customer for scheduling" },
  { code: "locate_goods", icon: Search, label: "Locate Goods", description: "Find goods for shipment" },
  { code: "prepare_loading", icon: Package, label: "Prepare Loading", description: "Prepare goods for loading" },
  { code: "load_goods", icon: BoxSelect, label: "Load Goods", description: "Load goods onto transport" },
  { code: "inventory_count", icon: ClipboardCheck, label: "Inventory Count", description: "Warehouse inventory count" },
  { code: "warehouse_cleaning", icon: Sparkles, label: "Cleaning", description: "Clean warehouse areas" },
  { code: "reorganization", icon: Wrench, label: "Optimization", description: "Reorganize warehouse" },
  { code: "special_services", icon: Tag, label: "Special Services", description: "Labeling, re-palletization, etc." },
]

export default function WarehouseWorkflowPage() {
  const { user } = useUser()

  // Fetch my tasks
  const { data: tasks, isLoading: tasksLoading, refetch } = useQuery({
    queryKey: ["my-staff-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/v1/staff-tasks?myTasks=true")
      if (!res.ok) throw new Error("Failed to fetch tasks")
      const data = await res.json()
      return data.data?.items || []
    },
    enabled: !!user,
  })

  // Group tasks by workflow step
  const tasksByStep = WORKFLOW_STEPS.map(step => {
    const stepTasks = tasks?.filter((t: StaffTask) => t.taskType?.code === step.code) || []
    return {
      ...step,
      tasks: stepTasks,
      pending: stepTasks.filter((t: StaffTask) => t.status === "pending" || t.status === "assigned").length,
      inProgress: stepTasks.filter((t: StaffTask) => t.status === "in_progress").length,
      completed: stepTasks.filter((t: StaffTask) => t.status === "completed").length,
    }
  })

  // Calculate overall progress
  const totalTasks = tasks?.length || 0
  const completedTasks = tasks?.filter((t: StaffTask) => t.status === "completed").length || 0
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const handleStartTask = async (taskId: string) => {
    try {
      await fetch(`/api/v1/staff-tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      })
      refetch()
    } catch (error) {
      console.error("Failed to start task:", error)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/v1/staff-tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      })
      refetch()
    } catch (error) {
      console.error("Failed to complete task:", error)
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Workflow Tasks</h1>
        <p className="text-muted-foreground">
          Follow the warehouse workflow steps
        </p>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Today's Progress</span>
            <Badge variant="secondary">{progressPercent}%</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercent} className="h-2 mb-4" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{completedTasks} completed</span>
            <span>{totalTasks - completedTasks} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <div className="space-y-4">
        {tasksLoading ? (
          Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))
        ) : (
          tasksByStep.map((step, index) => {
            const Icon = step.icon
            const hasActiveTasks = step.pending > 0 || step.inProgress > 0
            
            return (
              <Card 
                key={step.code} 
                className={`transition-all ${hasActiveTasks ? 'border-primary shadow-sm' : ''}`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    {/* Step Number & Icon */}
                    <div className={`
                      flex flex-col items-center
                      ${step.completed > 0 && step.pending === 0 && step.inProgress === 0 
                        ? 'text-green-500' 
                        : step.inProgress > 0 
                          ? 'text-yellow-500' 
                          : 'text-muted-foreground'}
                    `}>
                      <div className={`
                        h-10 w-10 rounded-full flex items-center justify-center
                        ${step.completed > 0 && step.pending === 0 && step.inProgress === 0 
                          ? 'bg-green-100 dark:bg-green-950' 
                          : step.inProgress > 0 
                            ? 'bg-yellow-100 dark:bg-yellow-950' 
                            : 'bg-muted'}
                      `}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs mt-1 font-medium">{index}</span>
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{step.label}</h3>
                        <div className="flex items-center gap-2">
                          {step.inProgress > 0 && (
                            <Badge variant="default" className="bg-yellow-500">
                              {step.inProgress} In Progress
                            </Badge>
                          )}
                          {step.pending > 0 && (
                            <Badge variant="secondary">
                              {step.pending} Pending
                            </Badge>
                          )}
                          {step.completed > 0 && (
                            <Badge variant="outline" className="text-green-500">
                              {step.completed} Done
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {step.description}
                      </p>

                      {/* Task List (if any) */}
                      {step.tasks.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {step.tasks.slice(0, 3).map((task: StaffTask) => (
                            <div 
                              key={task.id} 
                              className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${
                                  task.status === "completed" ? "bg-green-500" :
                                  task.status === "in_progress" ? "bg-yellow-500" :
                                  "bg-gray-400"
                                }`} />
                                <span className="truncate">
                                  {task.booking?.id ? `Booking ${task.booking.id.slice(0,8)}...` : "Task"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {task.status === "pending" || task.status === "assigned" ? (
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => handleStartTask(task.id)}
                                  >
                                    <PlayCircle className="h-4 w-4 mr-1" />
                                    Start
                                  </Button>
                                ) : task.status === "in_progress" ? (
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    onClick={() => handleCompleteTask(task.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Complete
                                  </Button>
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                )}
                              </div>
                            </div>
                          ))}
                          {step.tasks.length > 3 && (
                            <Link 
                              href={`/warehouse/tasks?step=${step.code}`}
                              className="text-xs text-primary hover:underline"
                            >
                              View all {step.tasks.length} tasks
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/warehouse/tasks">All Tasks</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/warehouse/scan">Scan Pallet</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/warehouse/inventory">Inventory</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
