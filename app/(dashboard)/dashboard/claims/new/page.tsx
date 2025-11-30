"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Upload } from "@/components/icons"
import Link from "next/link"
import { mockBookings } from "@/lib/mock-data"

export default function NewClaimPage() {
  const router = useRouter()
  const [claimType, setClaimType] = useState("")
  const [bookingId, setBookingId] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")

  const customerBookings = mockBookings.filter(
    (b) => b.customerId === "user-2" && (b.status === "active" || b.status === "completed"),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, this would submit to the API
    alert("Claim submitted successfully!")
    router.push("/dashboard/claims")
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
                  {customerBookings.map((booking) => (
                    <SelectItem key={booking.id} value={booking.id}>
                      #{booking.id} -{" "}
                      {booking.type === "pallet" ? `${booking.palletCount} pallets` : `${booking.areaSqFt} sq ft`}
                    </SelectItem>
                  ))}
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
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Drag and drop files here, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Supports: Images, PDFs, Documents (Max 10MB each)</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/dashboard/claims">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit">Submit Claim</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
