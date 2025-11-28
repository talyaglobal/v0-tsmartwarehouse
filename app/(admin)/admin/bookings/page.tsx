"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Plus, Eye, Edit, Trash2 } from "lucide-react"
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
import { mockBookings, mockCustomers, mockWarehouses } from "@/lib/mock-data"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Booking } from "@/types"
import Link from "next/link"

const columns: ColumnDef<Booking>[] = [
  {
    accessorKey: "booking_number",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Booking #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <Link href={`/admin/bookings/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.getValue("booking_number")}
      </Link>
    ),
  },
  {
    accessorKey: "customer_id",
    header: "Customer",
    cell: ({ row }) => {
      const customer = mockCustomers.find((c) => c.id === row.getValue("customer_id"))
      return (
        <div>
          <p className="font-medium">{customer?.full_name}</p>
          <p className="text-xs text-muted-foreground">{customer?.company_name}</p>
        </div>
      )
    },
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
    accessorKey: "service_type",
    header: "Service",
    cell: ({ row }) => {
      const type = row.getValue("service_type") as string
      return <span className="capitalize">{type.replace("_", " ")}</span>
    },
  },
  {
    accessorKey: "start_date",
    header: "Start Date",
    cell: ({ row }) => formatDate(row.getValue("start_date")),
  },
  {
    accessorKey: "total_amount",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => formatCurrency(row.getValue("total_amount")),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge type="booking" status={row.getValue("status")} />,
  },
  {
    accessorKey: "payment_status",
    header: "Payment",
    cell: ({ row }) => <StatusBadge type="payment" status={row.getValue("payment_status")} />,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const booking = row.original
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
              <Link href={`/admin/bookings/${booking.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              Edit Booking
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Cancel Booking
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export default function BookingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="Manage all warehouse bookings">
        <Button asChild>
          <Link href="/admin/bookings/new">
            <Plus className="mr-2 h-4 w-4" />
            New Booking
          </Link>
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={mockBookings}
        searchKey="booking_number"
        searchPlaceholder="Search bookings..."
      />
    </div>
  )
}
