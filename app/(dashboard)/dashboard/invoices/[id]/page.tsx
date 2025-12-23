"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { ArrowLeft, FileText, DollarSign, Calendar, Loader2 } from "@/components/icons"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Invoice } from "@/types"
import { api } from "@/lib/api/client"
import Link from "next/link"

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [invoiceId, setInvoiceId] = useState<string>("")

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = params instanceof Promise ? await params : params
      setInvoiceId(resolvedParams.id)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice()
    }
  }, [invoiceId])

  const fetchInvoice = async () => {
    if (!invoiceId) return
    try {
      setLoading(true)
      // Try to fetch from API - if endpoint doesn't exist, this will fail gracefully
      const result = await api.get<Invoice>(`/api/v1/invoices/${invoiceId}`, { showToast: false })
      if (result.success && result.data) {
        setInvoice(result.data)
      } else {
        console.error('Failed to fetch invoice:', result.error)
      }
    } catch (error) {
      console.error('Failed to fetch invoice:', error)
      // If API endpoint doesn't exist, show a message
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Invoice Details</h1>
        </div>
        <Card>
          <CardContent className="pt-6 text-center text-destructive">
            <p>Invoice not found or API endpoint not available.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Invoice #{invoice.id.substring(0, 8)}</h1>
        <StatusBadge status={invoice.status} className="ml-auto" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Invoice Overview</CardTitle>
            <CardDescription>Details about your invoice</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={invoice.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-semibold text-lg">{formatCurrency(invoice.total)}</span>
            </div>
            {invoice.subtotal && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
            )}
            {invoice.tax && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(invoice.tax)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Due Date
              </span>
              <span>{formatDate(invoice.dueDate)}</span>
            </div>
            {invoice.issueDate && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Issue Date
                </span>
                <span>{formatDate(invoice.issueDate)}</span>
              </div>
            )}
            {invoice.paidDate && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Paid Date
                </span>
                <span>{formatDate(invoice.paidDate)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Booking ID
              </span>
              <span className="text-sm">{invoice.bookingId?.substring(0, 8) || "N/A"}...</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Back to Invoices
        </Button>
        <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
          <Button>Edit Invoice</Button>
        </Link>
      </div>
    </div>
  )
}

