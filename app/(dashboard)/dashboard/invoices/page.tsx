"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye, Loader2, Edit, Trash, DollarSign } from "@/components/icons"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Invoice, PaymentRemaining } from "@/types"
import { api } from "@/lib/api/client"
import Link from "next/link"
import { useUser } from "@/lib/hooks/use-user"

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [paymentRemaining, setPaymentRemaining] = useState<PaymentRemaining | null>(null)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { user } = useUser()

  useEffect(() => {
    fetchInvoices()
    if (user?.id) {
      fetchPaymentRemaining(user.id)
    }
  }, [user?.id])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const result = await api.get('/api/v1/invoices', { showToast: false })
      if (result.success) {
        setInvoices(result.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPaymentRemaining = async (customerId: string) => {
    try {
      const result = await api.get<PaymentRemaining>(
        `/api/v1/customers/${customerId}/payment-remaining?summary=true`,
        { showToast: false }
      )
      if (result.success && result.data) {
        setPaymentRemaining(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch payment remaining:', error)
    }
  }

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return
    }

    setDeletingId(invoiceId)
    try {
      const result = await api.delete(`/api/v1/invoices/${invoiceId}`, {
        successMessage: 'Invoice deleted successfully',
        errorMessage: 'Failed to delete invoice',
      })

      if (result.success) {
        setInvoices(prev => prev.filter(i => i.id !== invoiceId))
      }
    } catch (error) {
      console.error('Failed to delete invoice:', error)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="View and manage your billing history" />

      {/* Payment Remaining Balance */}
      {paymentRemaining && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Invoiced</div>
                <div className="text-2xl font-bold">{formatCurrency(paymentRemaining.totalInvoiced)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Paid</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(paymentRemaining.totalPaid)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Remaining Balance</div>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(paymentRemaining.remainingBalance)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Pending/Overdue</div>
                <div className="text-2xl font-bold">
                  {paymentRemaining.pendingInvoicesCount + paymentRemaining.overdueInvoicesCount}
                </div>
                <div className="text-xs text-muted-foreground">
                  {paymentRemaining.pendingInvoicesCount} pending, {paymentRemaining.overdueInvoicesCount} overdue
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>Your complete billing history</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.id}</TableCell>
                  <TableCell>{invoice.bookingId}</TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell>{formatCurrency(invoice.total)}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/invoices/${invoice.id}`}>
                        <Button variant="ghost" size="sm" title="View details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
                        <Button variant="ghost" size="sm" title="Edit invoice">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete invoice"
                        onClick={() => handleDelete(invoice.id)}
                        disabled={deletingId === invoice.id}
                      >
                        {deletingId === invoice.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
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
