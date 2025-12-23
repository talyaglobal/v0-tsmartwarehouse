"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUpload, type UploadedFile, getUploadedFileUrls } from "@/components/ui/file-upload"
import { ArrowLeft, Loader2 } from "@/components/icons"
import Link from "next/link"
import type { Claim, ClaimStatus } from "@/types"
import { api } from "@/lib/api/client"

export default function EditClaimPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const [claimId, setClaimId] = useState<string>("")
  const [claim, setClaim] = useState<Claim | null>(null)
  const [claimType, setClaimType] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<ClaimStatus>("submitted")
  const [resolution, setResolution] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

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
        const claimData = result.data
        setClaim(claimData)
        setClaimType(claimData.type)
        setAmount(claimData.amount.toString())
        setDescription(claimData.description)
        setStatus(claimData.status)
        setResolution(claimData.resolution || "")
        // Convert existing evidence URLs to UploadedFile format if needed
        if (claimData.evidence && claimData.evidence.length > 0) {
          // For existing files, we create a minimal UploadedFile structure
          // Since we don't have the original File object, we'll use a placeholder
          const existingFiles: UploadedFile[] = claimData.evidence.map((url, index) => {
            // Create a dummy File object for existing files
            const dummyFile = new File([], `Evidence ${index + 1}`, { type: "image/*" })
            return {
              id: `existing-${index}`,
              file: dummyFile,
              url,
              status: 'success' as const,
            }
          })
          setUploadedFiles(existingFiles)
        }
      } else {
        console.error('Failed to fetch claim:', result.error)
      }
    } catch (error) {
      console.error('Failed to fetch claim:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Get uploaded file URLs
      const evidenceUrls = getUploadedFileUrls(uploadedFiles)

      // Update claim via API
      const result = await api.patch(`/api/v1/claims/${claimId}`, {
        type: claimType,
        amount: parseFloat(amount),
        description,
        status,
        resolution: resolution || undefined,
        evidence: evidenceUrls.length > 0 ? evidenceUrls : undefined,
      }, {
        successMessage: 'Claim updated successfully',
        errorMessage: 'Failed to update claim',
      })

      if (result.success) {
        router.push(`/dashboard/claims/${claimId}`)
      } else {
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Error updating claim:', error)
      setIsSubmitting(false)
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
          <h1 className="text-lg font-bold">Edit Claim</h1>
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
        <Link href={`/dashboard/claims/${claimId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader title="Edit Claim" description="Update claim information" />
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Claim Details</CardTitle>
          <CardDescription>
            Update the claim information below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="type">Claim Type</Label>
              <Select value={claimType} onValueChange={setClaimType} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select claim type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="loss">Loss/Missing Items</SelectItem>
                  <SelectItem value="theft">Theft</SelectItem>
                  <SelectItem value="delay">Service Delay</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ClaimStatus)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under-review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Claim Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the incident in detail..."
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution (Optional)</Label>
              <Textarea
                id="resolution"
                placeholder="Resolution notes..."
                rows={3}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Evidence (Optional)</Label>
              <FileUpload
                value={uploadedFiles}
                onChange={setUploadedFiles}
                bucket="claim-evidence"
                folder="claims"
                maxFiles={10}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex gap-3">
              <Link href={`/dashboard/claims/${claimId}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Claim'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

