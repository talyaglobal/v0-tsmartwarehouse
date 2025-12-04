"use client"

import { useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FileText, Search, MoreHorizontal, DollarSign, Clock, CheckCircle, Plus, Download, Loader2 } from "@/components/icons"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { InvoiceStatus, Invoice } from "@/types"

const statusColors: Record<InvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  pending: "outline",
  paid: "default",
  overdue: "destructive",
  cancelled: "secondary",
}

export default function InvoicesPage() {
  const [search, setSearch] = useState("")
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/invoices')
      if (response.ok) {
        const data = await response.json()
        setInvoices(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = invoices.filter((invoice) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      invoice.id.toLowerCase().includes(searchLower) ||
      invoice.customerName.toLowerCase().includes(searchLower)
    )
  })

  const totalPending = invoices.filter((i) => i.status === "pending").reduce((sum, i) => sum + i.total, 0)
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.total, 0)
  const avgInvoice = invoices.length > 0 ? invoices.reduce((sum, i) => sum + i.total, 0) / invoices.length : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Manage billing and payments"
        action={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Pending Amount"
          value={formatCurrency(totalPending)}
          icon={Clock}
          description="Awaiting payment"
        />
        <StatCard title="Paid (30d)" value={formatCurrency(totalPaid)} icon={CheckCircle} description="This month" />
        <StatCard title="Total Invoices" value={invoices.length.toString()} icon={FileText} />
        <StatCard title="Avg. Invoice" value={formatCurrency(avgInvoice)} icon={DollarSign} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Invoices</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Paid Date</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <span className="font-medium">#{invoice.id}</span>
                  </TableCell>
                  <TableCell>{invoice.customerName}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(invoice.total)}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell>{invoice.paidDate ? formatDate(invoice.paidDate) : "-"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Download className="mr-2 h-4 w-4" />
                          Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Send Reminder</DropdownMenuItem>
                        <DropdownMenuItem>Mark as Paid</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
