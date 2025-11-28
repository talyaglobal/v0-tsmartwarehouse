"use client"

import * as React from "react"
import { WorkerHeader } from "@/components/worker/worker-header"
import { TaskCard } from "@/components/worker/task-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { mockTasks, mockWorkers } from "@/lib/mock-data"
import { Search } from "lucide-react"

export default function WorkerTasksPage() {
  const [search, setSearch] = React.useState("")
  const worker = mockWorkers[0]
  const myTasks = mockTasks.filter((t) => t.assigned_to === worker.id)

  const filteredTasks = myTasks.filter((task) => task.title.toLowerCase().includes(search.toLowerCase()))

  const pendingTasks = filteredTasks.filter((t) => t.status === "pending")
  const inProgressTasks = filteredTasks.filter((t) => t.status === "in_progress")
  const completedTasks = filteredTasks.filter((t) => t.status === "completed")

  return (
    <div className="flex flex-col min-h-screen">
      <WorkerHeader title="My Tasks" />

      <main className="flex-1 p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="text-xs">
              Pending ({pendingTasks.length})
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="text-xs">
              In Progress ({inProgressTasks.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">
              Done ({completedTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4 space-y-3">
            {pendingTasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No pending tasks</p>
            ) : (
              pendingTasks.map((task) => <TaskCard key={task.id} task={task} />)
            )}
          </TabsContent>

          <TabsContent value="in_progress" className="mt-4 space-y-3">
            {inProgressTasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No tasks in progress</p>
            ) : (
              inProgressTasks.map((task) => <TaskCard key={task.id} task={task} />)
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4 space-y-3">
            {completedTasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No completed tasks</p>
            ) : (
              completedTasks.map((task) => <TaskCard key={task.id} task={task} />)
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
