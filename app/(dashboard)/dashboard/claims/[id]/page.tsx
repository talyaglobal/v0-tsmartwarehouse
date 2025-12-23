"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { ArrowLeft, FileText, DollarSign, Calendar, User, Package, Clock, Loader2 } from "@/components/icons"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Claim } from "@/types"
import { api } from "@/lib/api/client"

export default function ClaimDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [claim, setClaim] = useState<Claim | null>(null)
  const [claimId, setClaimId] = useState<string>("")

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = params instanceof Promise ? await params : params
      setClaimId(resolvedParams.id)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (claimId) {
      fetchClaim()
    }
  }, [claimId])

  const fetchClaim = async () => {
    if (!claimId) return
    try {
      setLoading(true)
      const result = await api.get<Claim>(`/api/v1/claims/${claimId}`, { showToast: false })
      if (result.success && result.data) {
        setClaim(result.data)
      } else {
        console.error('Failed to fetch claim:', result.error)
      }
    } catch (error) {
      console.error('Failed to fetch claim:', error)
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

  if (!claim) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Claim Details</h1>
        </div>
        <Card>
          <CardContent className="pt-6 text-center text-destructive">
            <p>Claim not found.</p>
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
        <h1 className="text-2xl font-bold">Claim #{claim.id.substring(0, 8)}</h1>
        <StatusBadge status={claim.status} className="ml-auto" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Claim Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Claim Overview</CardTitle>
            <CardDescription>Details about your claim</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge className="capitalize flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {claim.type}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={claim.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-semibold text-lg">{formatCurrency(claim.amount)}</span>
            </div>
            {claim.approvedAmount && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Approved Amount</span>
                <span className="font-semibold text-green-600">{formatCurrency(claim.approvedAmount)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Claim Details */}
        <Card>
          <CardHeader>
            <CardTitle>Claim Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Submitted
              </span>
              <span>{formatDate(claim.createdAt)}</span>
            </div>
            {claim.resolvedAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Resolved
                </span>
                <span>{formatDate(claim.resolvedAt)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" /> Booking ID
              </span>
              <span className="text-sm">{claim.bookingId.substring(0, 8)}...</span>
            </div>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" /> Name
              </span>
              <span>{claim.customerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Customer ID
              </span>
              <span className="text-sm">{claim.customerId.substring(0, 8)}...</span>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{claim.description}</p>
          </CardContent>
        </Card>

        {/* Resolution */}
        {claim.resolution && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Resolution</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{claim.resolution}</p>
            </CardContent>
          </Card>
        )}

        {/* Evidence */}
        {claim.evidence && claim.evidence.length > 0 && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {claim.evidence.map((evidence, index) => (
                  <div key={index} className="border rounded-lg p-2">
                    <a
                      href={evidence}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Evidence {index + 1}
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Back to Claims
        </Button>
        <Button onClick={() => router.push(`/dashboard/claims/${claim.id}/edit`)}>
          Edit Claim
        </Button>
      </div>
    </div>
  )
}

