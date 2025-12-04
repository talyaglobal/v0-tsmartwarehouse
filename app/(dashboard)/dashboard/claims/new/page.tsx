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
import type { Booking } from "@/types"

export default function NewClaimPage() {
  const router = useRouter()
  const [claimType, setClaimType] = useState("")
  const [bookingId, setBookingId] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/bookings')
      if (response.ok) {
        const data = await response.json()
        const activeBookings = (data.data || []).filter(
          (b: Booking) => b.status === "active" || b.status === "completed" || b.status === "confirmed"
        )
        setBookings(activeBookings)
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  const customerBookings = bookings

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Get uploaded file URLs
      const evidenceUrls = getUploadedFileUrls(uploadedFiles)

      // Submit claim to API
      const response = await fetch('/api/v1/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId,
          type: claimType,
          amount: parseFloat(amount),
          description,
          evidence: evidenceUrls,
        }),
      })

      const result = await response.json()

      if (result.success) {
        router.push("/dashboard/claims")
      } else {
        alert(result.error || 'Failed to submit claim. Please try again.')
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Error submitting claim:', error)
      alert('An error occurred while submitting your claim. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/claims">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader title="Submit a Claim" description="Report damage, loss, or other issues" />
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Claim Details</CardTitle>
          <CardDescription>
            Please provide as much detail as possible to help us process your claim quickly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="booking">Related Booking</Label>
              <Select value={bookingId} onValueChange={setBookingId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a booking" />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : customerBookings.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">No active bookings found</div>
                  ) : (
                    customerBookings.map((booking) => (
                      <SelectItem key={booking.id} value={booking.id}>
                        #{booking.id} -{" "}
                        {booking.type === "pallet" ? `${booking.palletCount} pallets` : `${booking.areaSqFt} sq ft`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

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
              <Label htmlFor="amount">Estimated Claim Amount ($)</Label>
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
                placeholder="Describe the incident in detail, including what happened, when it occurred, and items affected..."
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
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
              <Link href="/dashboard/claims">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Claim'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
