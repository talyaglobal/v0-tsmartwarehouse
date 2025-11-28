"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Plus, Eye, CheckCircle, XCircle } from "lucide-react"
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
import { mockClaims, mockIncidents, mockCustomers } from "@/lib/mock-data"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Claim } from "@/types"
import Link from "next/link"

const columns: ColumnDef<Claim>[] = [
  {
    accessorKey: "claim_number",
    header: "Claim #",
    cell: ({ row }) => (
      <Link href={`/admin/claims/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.getValue("claim_number")}
      </Link>
    ),
  },
  {
    accessorKey: "incident_id",
    header: "Incident",
    cell: ({ row }) => {
      const incident = mockIncidents.find((i) => i.id === row.getValue("incident_id"))
      return incident?.incident_number || "N/A"
    },
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
    accessorKey: "claimed_amount",
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Claimed
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => formatCurrency(row.getValue("claimed_amount")),
  },
  {
    accessorKey: "approved_amount",
    header: "Approved",
    cell: ({ row }) => {
      const amount = row.getValue("approved_amount") as number | undefined
      return amount ? formatCurrency(amount) : "—"
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge type="claim" status={row.getValue("status")} />,
  },
  {
    accessorKey: "submitted_at",
    header: "Submitted",
    cell: ({ row }) => formatDate(row.getValue("submitted_at")),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const claim = row.original
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
              <Link href={`/admin/claims/${claim.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-emerald-600">
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve Claim
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">
              <XCircle className="mr-2 h-4 w-4" />
              Deny Claim
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export default function ClaimsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Claims" description="Manage insurance and damage claims">
        <Button asChild>
          <Link href="/admin/claims/new">
            <Plus className="mr-2 h-4 w-4" />
            New Claim
          </Link>
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={mockClaims} searchKey="claim_number" searchPlaceholder="Search claims..." />
    </div>
  )
}
