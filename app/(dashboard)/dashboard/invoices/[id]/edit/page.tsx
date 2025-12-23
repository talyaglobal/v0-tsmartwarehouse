"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page-header"
import { ArrowLeft, Loader2 } from "@/components/icons"
import { api } from "@/lib/api/client"
import type { Invoice, InvoiceStatus } from "@/types"

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const [invoiceId, setInvoiceId] = useState<string>("")
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<InvoiceStatus>("pending")

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
      const result = await api.get<Invoice>(`/api/v1/invoices/${invoiceId}`, { showToast: false })
      if (result.success && result.data) {
        const invoiceData = result.data
        setInvoice(invoiceData)
        setStatus(invoiceData.status)
      } else {
        console.error('Failed to fetch invoice:', result.error)
      }
    } catch (error) {
      console.error('Failed to fetch invoice:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const result = await api.patch(`/api/v1/invoices/${invoiceId}`, {
        status,
      }, {
        successMessage: 'Invoice updated successfully',
        errorMessage: 'Failed to update invoice',
      })

      if (result.success) {
        router.push(`/dashboard/invoices/${invoiceId}`)
      } else {
        setIsSaving(false)
      }
    } catch (error) {
      console.error('Error updating invoice:', error)
      setIsSaving(false)
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
          <h1 className="text-lg font-bold">Edit Invoice</h1>
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
        <Link href={`/dashboard/invoices/${invoiceId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader title="Edit Invoice" description="Update invoice information" />
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
            <CardDescription>
              Update the invoice information below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
              <div className="font-semibold">Invoice Information (Read-only)</div>
              <div>Total: ${invoice.total.toFixed(2)}</div>
              <div>Due Date: {new Date(invoice.dueDate).toLocaleDateString()}</div>
              {invoice.bookingId && <div>Booking ID: {invoice.bookingId.substring(0, 8)}...</div>}
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Link href={`/dashboard/invoices/${invoiceId}`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Invoice
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}

