"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Plus, Eye, Edit, Mail } from "lucide-react"
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
import { StatusBadge } from "@/components/ui/status-badge"
import { mockCustomers } from "@/lib/mock-data"
import { formatCurrency, formatDate, getInitials } from "@/lib/utils/format"
import type { Customer } from "@/types"
import Link from "next/link"

const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: "full_name",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Customer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const customer = row.original
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={customer.avatar_url || "/placeholder.svg"} />
            <AvatarFallback>{getInitials(customer.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{customer.full_name}</p>
            <p className="text-xs text-muted-foreground">{customer.email}</p>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "company_name",
    header: "Company",
    cell: ({ row }) => row.getValue("company_name") || "—",
  },
  {
    accessorKey: "membership_tier",
    header: "Tier",
    cell: ({ row }) => <StatusBadge type="membership" status={row.getValue("membership_tier")} />,
  },
  {
    accessorKey: "total_spent",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Total Spent
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => formatCurrency(row.getValue("total_spent")),
  },
  {
    accessorKey: "loyalty_points",
    header: "Points",
    cell: ({ row }) => row.getValue("loyalty_points")?.toLocaleString() || "0",
  },
  {
    accessorKey: "created_at",
    header: "Joined",
    cell: ({ row }) => formatDate(row.getValue("created_at")),
  },
  {
    accessorKey: "is_active",
    header: "Status",
    cell: ({ row }) => (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          row.getValue("is_active") ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
        }`}
      >
        {row.getValue("is_active") ? "Active" : "Inactive"}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const customer = row.original
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
              <Link href={`/admin/customers/${customer.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="mr-2 h-4 w-4" />
              Edit Customer
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Mail className="mr-2 h-4 w-4" />
              Send Email
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Manage customer accounts and relationships">
        <Button asChild>
          <Link href="/admin/customers/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Link>
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={mockCustomers} searchKey="full_name" searchPlaceholder="Search customers..." />
    </div>
  )
}
