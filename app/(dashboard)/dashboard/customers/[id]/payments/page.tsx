'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api/client'
import { Loader2, DollarSign, CreditCard, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import type { PaymentRemaining, Payment } from '@/types'

export default function CustomerPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolvedParams = use(Promise.resolve(params))
  const customerId = resolvedParams.id

  // Fetch payment summary
  const { data: paymentSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['customer-payment-summary', customerId],
    queryFn: async () => {
      const result = await api.get<PaymentRemaining>(
        `/api/v1/customers/${customerId}/payment-remaining?summary=true`,
        { showToast: false }
      )
      return result.success && result.data ? result.data : null
    },
  })

  // Fetch payment history
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['customer-payments', customerId],
    queryFn: async () => {
      const result = await api.get<Payment[]>(
        `/api/v1/payments?customerId=${customerId}`,
        { showToast: false }
      )
      return result.success ? (result.data || []) : []
    },
  })

  const isLoading = summaryLoading || paymentsLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment History"
        description="View payment history and remaining balance for this customer"
      />

      {/* Payment Summary */}
      {paymentSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(paymentSummary.totalInvoiced)}</div>
              <p className="text-xs text-muted-foreground mt-1">All time invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(paymentSummary.totalPaid)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Successfully paid</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining Balance</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(paymentSummary.remainingBalance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {paymentSummary.pendingInvoicesCount + paymentSummary.overdueInvoicesCount} unpaid
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending/Overdue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {paymentSummary.pendingInvoicesCount + paymentSummary.overdueInvoicesCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {paymentSummary.pendingInvoicesCount} pending, {paymentSummary.overdueInvoicesCount}{' '}
                overdue
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Summary Details */}
      {paymentSummary && paymentSummary.remainingBalance > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
              <AlertCircle className="h-5 w-5" />
              Outstanding Balance
            </CardTitle>
            <CardDescription>
              This customer has an outstanding balance that requires attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(paymentSummary.remainingBalance)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {paymentSummary.pendingInvoicesCount} pending invoice
                  {paymentSummary.pendingInvoicesCount !== 1 ? 's' : ''} and{' '}
                  {paymentSummary.overdueInvoicesCount} overdue invoice
                  {paymentSummary.overdueInvoicesCount !== 1 ? 's' : ''}
                </p>
              </div>
              <Badge variant="destructive" className="text-lg px-4 py-2">
                Action Required
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>
            Complete payment history for this customer ({payments.length} payment{payments.length !== 1 ? 's' : ''})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No payment history found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment ID</TableHead>
                  <TableHead>Invoice ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-sm">{payment.id.substring(0, 8)}...</TableCell>
                    <TableCell className="font-mono text-sm">{payment.invoiceId.substring(0, 8)}...</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {payment.paymentMethod.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.status === 'succeeded'
                            ? 'default'
                            : payment.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="capitalize"
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(payment.createdAt)}</TableCell>
                    <TableCell>
                      {payment.completedAt ? (
                        <span className="text-sm text-muted-foreground">
                          {formatDate(payment.completedAt)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Summary Breakdown */}
      {paymentSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Summary Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Total Invoiced</span>
                <span className="font-semibold">{formatCurrency(paymentSummary.totalInvoiced)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Total Paid</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(paymentSummary.totalPaid)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-t-2">
                <span className="font-semibold">Remaining Balance</span>
                <span className="text-2xl font-bold text-orange-600">
                  {formatCurrency(paymentSummary.remainingBalance)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

