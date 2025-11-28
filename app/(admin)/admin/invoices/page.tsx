"use client"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown, Plus, Eye, Download, Send } from "lucide-react"
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
import { mockInvoices, mockCustomers } from "@/lib/mock-data"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Invoice } from "@/types"
import Link from "next/link"

const columns: ColumnDef<Invoice>[] = [
  {
    accessorKey: "invoice_number",
    header: "Invoice #",
    cell: ({ row }) => (
      <Link href={`/admin/invoices/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.getValue("invoice_number")}
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
    accessorKey: "paid_amount",
    header: "Paid",
    cell: ({ row }) => formatCurrency(row.getValue("paid_amount")),
  },
  {
    accessorKey: "due_date",
    header: "Due Date",
    cell: ({ row }) => {
      const dueDate = row.getValue("due_date") as string
      const isPast = new Date(dueDate) < new Date()
      const status = row.original.status
      return (
        <span className={isPast && status !== "paid" ? "text-red-600 font-medium" : ""}>{formatDate(dueDate)}</span>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge type="payment" status={row.getValue("status")} />,
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => formatDate(row.getValue("created_at")),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const invoice = row.original
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
              <Link href={`/admin/invoices/${invoice.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Invoice
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Send className="mr-2 h-4 w-4" />
              Send Reminder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Manage billing and invoices">
        <Button asChild>
          <Link href="/admin/invoices/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Link>
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={mockInvoices}
        searchKey="invoice_number"
        searchPlaceholder="Search invoices..."
      />
    </div>
  )
}
