"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Plus, Eye, Play, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/ui/data-table"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { mockTasks, mockWorkers } from "@/lib/mock-data"
import { formatDate } from "@/lib/utils/format"
import type { Task } from "@/types"
import Link from "next/link"

const columns: ColumnDef<Task>[] = [
  {
    accessorKey: "title",
    header: "Task",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.getValue("title")}</p>
        <p className="text-xs text-muted-foreground capitalize">{row.original.type.replace("_", " ")}</p>
      </div>
    ),
  },
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }) => <StatusBadge type="priority" status={row.getValue("priority")} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge type="task" status={row.getValue("status")} />,
  },
  {
    accessorKey: "assigned_to",
    header: "Assigned To",
    cell: ({ row }) => {
      const worker = mockWorkers.find((w) => w.id === row.getValue("assigned_to"))
      return worker?.full_name || "Unassigned"
    },
  },
  {
    accessorKey: "due_date",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Due Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const dueDate = row.getValue("due_date") as string
      if (!dueDate) return "—"
      const isOverdue = new Date(dueDate) < new Date()
      return <span className={isOverdue ? "text-red-600 font-medium" : ""}>{formatDate(dueDate)}</span>
    },
  },
  {
    accessorKey: "estimated_minutes",
    header: "Est. Time",
    cell: ({ row }) => {
      const minutes = row.getValue("estimated_minutes") as number
      if (!minutes) return "—"
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const task = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/admin/tasks/${task.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            {task.status === "pending" && (
              <DropdownMenuItem>
                <Play className="mr-2 h-4 w-4" />
                Start Task
              </DropdownMenuItem>
            )}
            {task.status === "in_progress" && (
              <DropdownMenuItem>
                <CheckCircle className="mr-2 h-4 w-4" />
                Complete Task
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Manage warehouse tasks and assignments">
        <Button asChild>
          <Link href="/admin/tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Link>
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={mockTasks} searchKey="title" searchPlaceholder="Search tasks..." />
    </div>
  )
}
