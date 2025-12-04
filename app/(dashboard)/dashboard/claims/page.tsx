"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, Plus, Clock, CheckCircle, FileText, Loader2 } from "@/components/icons"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Claim } from "@/types"

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClaims()
  }, [])

  const fetchClaims = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/claims')
      if (response.ok) {
        const data = await response.json()
        setClaims(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch claims:', error)
    } finally {
      setLoading(false)
    }
  }

  const customerClaims = claims
  const openClaims = customerClaims.filter((c) => c.status === 'submitted' || c.status === 'under-review')
  const approvedClaims = customerClaims.filter((c) => c.status === 'approved')
  const approvedTotal = approvedClaims.reduce((sum, c) => sum + c.amount, 0)

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
        title="Claims"
        description="Submit and track damage or loss claims"
      >
        <Link href="/dashboard/claims/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Submit Claim
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Claims</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openClaims.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedClaims.length}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(approvedTotal)} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerClaims.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Claim History</CardTitle>
          <CardDescription>View all your submitted claims</CardDescription>
        </CardHeader>
        <CardContent>
          {customerClaims.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">#{claim.id}</TableCell>
                    <TableCell className="capitalize">{claim.type}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{claim.description}</TableCell>
                    <TableCell>{formatCurrency(claim.amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={claim.status} />
                    </TableCell>
                    <TableCell>{formatDate(claim.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No claims yet</h3>
              <p className="text-muted-foreground mb-4">
                Submit a claim if you experience any issues with your stored goods.
              </p>
              <Link href="/dashboard/claims/new">
                <Button>Submit Your First Claim</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
