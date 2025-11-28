"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Plus, Eye, Edit, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/ui/data-table"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { mockIncidents, mockBookings } from "@/lib/mock-data"
import { formatRelativeTime } from "@/lib/utils/format"
import type { Incident } from "@/types"
import Link from "next/link"

const columns: ColumnDef<Incident>[] = [
  {
    accessorKey: "incident_number",
    header: "Incident #",
    cell: ({ row }) => (
      <Link href={`/admin/incidents/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.getValue("incident_number")}
      </Link>
    ),
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => <p className="max-w-[200px] truncate">{row.getValue("title")}</p>,
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => <span className="capitalize">{row.getValue("type")}</span>,
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => <StatusBadge type="severity" status={row.getValue("severity")} />,
  },
  {
    accessorKey: "booking_id",
    header: "Booking",
    cell: ({ row }) => {
      const booking = mockBookings.find((b) => b.id === row.getValue("booking_id"))
      return booking?.booking_number || "N/A"
    },
  },
  {
    accessorKey: "reported_at",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Reported
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => formatRelativeTime(row.getValue("reported_at")),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const config: Record<string, { label: string; color: string; bgColor: string }> = {
        open: { label: "Open", color: "text-red-700", bgColor: "bg-red-100" },
        investigating: { label: "Investigating", color: "text-amber-700", bgColor: "bg-amber-100" },
        resolved: { label: "Resolved", color: "text-emerald-700", bgColor: "bg-emerald-100" },
        closed: { label: "Closed", color: "text-gray-700", bgColor: "bg-gray-100" },
      }
      const statusConfig = config[status]
      return (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
        >
          {statusConfig.label}
        </span>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const incident = row.original
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
              <Link href={`/admin/incidents/${incident.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              Update Status
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Resolved
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export default function IncidentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Incidents" description="Track and manage warehouse incidents">
        <Button asChild>
          <Link href="/admin/incidents/new">
            <Plus className="mr-2 h-4 w-4" />
            Report Incident
          </Link>
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={mockIncidents}
        searchKey="incident_number"
        searchPlaceholder="Search incidents..."
      />
    </div>
  )
}
