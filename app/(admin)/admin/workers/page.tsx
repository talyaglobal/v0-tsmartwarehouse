"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Plus, Eye, Edit, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DataTable } from "@/components/ui/data-table"
import { PageHeader } from "@/components/ui/page-header"
import { mockWorkers, mockWarehouses } from "@/lib/mock-data"
import { formatCurrency, getInitials } from "@/lib/utils/format"
import type { Worker } from "@/types"
import Link from "next/link"

const columns: ColumnDef<Worker>[] = [
  {
    accessorKey: "full_name",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Worker
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const worker = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={worker.avatar_url || "/placeholder.svg"} />
            <AvatarFallback>{getInitials(worker.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{worker.full_name}</p>
            <p className="text-xs text-muted-foreground">{worker.employee_id}</p>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "department",
    header: "Department",
  },
  {
    accessorKey: "warehouse_id",
    header: "Warehouse",
    cell: ({ row }) => {
      const warehouse = mockWarehouses.find((w) => w.id === row.getValue("warehouse_id"))
      return warehouse?.name || "N/A"
    },
  },
  {
    accessorKey: "shift",
    header: "Shift",
    cell: ({ row }) => <span className="capitalize">{row.getValue("shift")}</span>,
  },
  {
    accessorKey: "hourly_rate",
    header: "Rate",
    cell: ({ row }) => `${formatCurrency(row.getValue("hourly_rate"))}/hr`,
  },
  {
    accessorKey: "is_available",
    header: "Status",
    cell: ({ row }) => (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          row.getValue("is_available") ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
        }`}
      >
        {row.getValue("is_available") ? "Available" : "Busy"}
      </span>
    ),
  },
  {
    accessorKey: "skills",
    header: "Skills",
    cell: ({ row }) => {
      const skills = row.getValue("skills") as string[]
      return (
        <div className="flex gap-1 flex-wrap max-w-[200px]">
          {skills.slice(0, 2).map((skill) => (
            <span key={skill} className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs">
              {skill}
            </span>
          ))}
          {skills.length > 2 && <span className="text-xs text-muted-foreground">+{skills.length - 2}</span>}
        </div>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const worker = row.original
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
              <Link href={`/admin/workers/${worker.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              Edit Worker
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Calendar className="mr-2 h-4 w-4" />
              View Schedule
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export default function WorkersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Workers" description="Manage warehouse staff">
        <Button asChild>
          <Link href="/admin/workers/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Worker
          </Link>
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={mockWorkers} searchKey="full_name" searchPlaceholder="Search workers..." />
    </div>
  )
}
