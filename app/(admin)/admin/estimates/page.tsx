"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, FileText, Mail, MoreHorizontal } from "@/components/icons"
import Link from "next/link"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { ArrowLeft } from "@/components/icons"
import type { Estimate } from "@/types"

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  sent: "bg-blue-500",
  accepted: "bg-green-500",
  rejected: "bg-red-500",
  expired: "bg-orange-500",
  converted: "bg-emerald-600",
}

export default function AdminEstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [contextEstimate, setContextEstimate] = useState<Estimate | null>(null)
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [sendEmail, setSendEmail] = useState(true)
  const [toEmail, setToEmail] = useState("")
  const [creating, setCreating] = useState(false)

  const fetchEstimates = useCallback(async () => {
    const res = await fetch("/api/v1/estimates")
    const data = await res.json()
    if (data.success && data.data) setEstimates(data.data)
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch("/api/v1/estimates"),
      fetch("/api/v1/invoice-templates"),
    ])
      .then(([r1, r2]) => Promise.all([r1.json(), r2.json()]))
      .then(([d1, d2]) => {
        if (d1.success && d1.data) setEstimates(d1.data)
        if (d2.success && d2.data) setTemplates(d2.data)
      })
      .finally(() => setLoading(false))
  }, [fetchEstimates])

  const openCreateInvoice = (estimate: Estimate) => {
    setContextEstimate(estimate)
    setToEmail(estimate.customerEmail ?? "")
    setSelectedTemplateId(templates[0]?.id ?? "")
    setCreateInvoiceOpen(true)
  }

  const handleCreateInvoice = async () => {
    if (!contextEstimate) return
    setCreating(true)
    try {
      const res = await fetch(`/api/v1/estimates/${contextEstimate.id}/create-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId || undefined,
          sendEmail,
          toEmail: toEmail || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setCreateInvoiceOpen(false)
        setContextEstimate(null)
        await fetchEstimates()
      } else {
        alert(data.error ?? "Failed to create invoice")
      }
    } catch (e) {
      alert("Request failed")
    } finally {
      setCreating(false)
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
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
      <PageHeader
        title="Estimates"
        description="Use row actions → Create invoice. Choose template and send PDF by email (Resend)."
      />
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estimate #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Recurring</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No estimates found. Create from Orders or create new.
                  </TableCell>
                </TableRow>
              ) : (
                estimates.map((est) => (
                  <TableRow key={est.id}>
                    <TableCell className="font-medium">{est.estimateNumber}</TableCell>
                    <TableCell>{est.customerName}</TableCell>
                    <TableCell>{formatCurrency(est.total)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[est.status] ?? "bg-gray-500"} variant="secondary">
                        {est.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(est.estimateDate)}</TableCell>
                    <TableCell>{est.isRecurring ? `${est.recurringInterval ?? "monthly"}` : "–"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={est.status === "converted"}
                            onSelect={() => openCreateInvoice(est)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Create invoice
                          </DropdownMenuItem>
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

      <Dialog open={createInvoiceOpen} onOpenChange={setCreateInvoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create invoice from estimate</DialogTitle>
            <DialogDescription>
              Select a template and optionally send the invoice as PDF by email (Resend).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Template</Label>
              <select
                className="w-full mt-1 border rounded-md px-3 py-2"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="sendEmail"
                checked={sendEmail}
                onCheckedChange={(c) => setSendEmail(c === true)}
              />
              <Label htmlFor="sendEmail">Send PDF by email (Resend)</Label>
            </div>
            {sendEmail && (
              <div>
                <Label>To email</Label>
                <Input
                  type="email"
                  placeholder="customer@example.com"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateInvoiceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Create invoice {sendEmail ? "& send email" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
