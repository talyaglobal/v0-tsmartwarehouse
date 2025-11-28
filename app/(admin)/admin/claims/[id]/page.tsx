"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Separator } from "@/components/ui/separator"
import { mockClaims, mockIncidents, mockCustomers } from "@/lib/mock-data"
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils/format"
import { ArrowLeft, DollarSign, FileText, User, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"

export default function ClaimDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [approvedAmount, setApprovedAmount] = React.useState("")
  const [adjusterNotes, setAdjusterNotes] = React.useState("")

  const claim = mockClaims.find((c) => c.id === params.id)
  const incident = claim?.incident_id ? mockIncidents.find((i) => i.id === claim.incident_id) : null
  const customer = claim?.customer_id ? mockCustomers.find((c) => c.id === claim.customer_id) : null

  if (!claim) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Claim not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={claim.claim_number} description={`Claim for incident ${incident?.incident_number || "N/A"}`}>
        <Button variant="outline" asChild>
          <Link href="/admin/claims">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Claim Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Claim Details</CardTitle>
                  <CardDescription>Submitted {formatRelativeTime(claim.submitted_at)}</CardDescription>
                </div>
                <StatusBadge type="claim" status={claim.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground mb-1">Claimed Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(claim.claimed_amount)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground mb-1">Approved Amount</p>
                  <p className="text-2xl font-bold">
                    {claim.approved_amount ? formatCurrency(claim.approved_amount) : "Pending"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="font-medium">{customer?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{customer?.company_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Related Incident</p>
                    <Link
                      href={`/admin/incidents/${incident?.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {incident?.incident_number}
                    </Link>
                    <p className="text-sm text-muted-foreground capitalize">
                      {incident?.type} - {incident?.severity}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Related Incident */}
          {incident && (
            <Card>
              <CardHeader>
                <CardTitle>Incident Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-1">{incident.title}</h4>
                  <p className="text-muted-foreground text-sm">{incident.description}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Occurred:</span> {formatDate(incident.occurred_at)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Location:</span> {incident.location}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Items:</span> {incident.affected_items.length}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Adjuster Review */}
          <Card>
            <CardHeader>
              <CardTitle>Adjuster Review</CardTitle>
              <CardDescription>Review and process this claim</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="approved_amount">Approved Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="approved_amount"
                    type="number"
                    placeholder="0.00"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Adjuster Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about the claim review..."
                  value={adjusterNotes}
                  onChange={(e) => setAdjusterNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="default">
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve Claim
              </Button>
              <Button className="w-full bg-transparent" variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Request Info
              </Button>
              <Button className="w-full" variant="destructive">
                <XCircle className="mr-2 h-4 w-4" />
                Deny Claim
              </Button>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                    <div className="w-px flex-1 bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="font-medium">Claim submitted</p>
                    <p className="text-sm text-muted-foreground">{formatRelativeTime(claim.submitted_at)}</p>
                  </div>
                </div>
                {claim.reviewed_at && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                    </div>
                    <div>
                      <p className="font-medium">Claim reviewed</p>
                      <p className="text-sm text-muted-foreground">{formatRelativeTime(claim.reviewed_at)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Evidence */}
          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              {claim.evidence_urls.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {claim.evidence_urls.map((url, i) => (
                    <div key={i} className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No evidence uploaded</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
