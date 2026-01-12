"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Loader2, Save, AlertCircle } from "@/components/icons"
import { api } from "@/lib/api/client"
import type { Booking, BookingStatus } from "@/types"

const BOOKING_STATUSES: { value: BookingStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'payment_pending', label: 'Payment Pending' },
  { value: 'awaiting_time_slot', label: 'Awaiting Time Slot' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function AdminBookingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    status: '' as BookingStatus,
    startDate: '',
    endDate: '',
    palletCount: 0,
    areaSqFt: 0,
    totalAmount: 0,
    notes: '',
    proposedStartDate: '',
    proposedStartTime: '',
  })

  useEffect(() => {
    fetchBooking()
  }, [resolvedParams.id])

  const fetchBooking = async () => {
    try {
      setLoading(true)
      const result = await api.get(`/api/v1/bookings/${resolvedParams.id}`, { showToast: false })
      if (result.success && result.data) {
        setBooking(result.data)
        setFormData({
          status: result.data.status || 'pending',
          startDate: result.data.startDate?.split('T')[0] || '',
          endDate: result.data.endDate?.split('T')[0] || '',
          palletCount: result.data.palletCount || 0,
          areaSqFt: result.data.areaSqFt || 0,
          totalAmount: result.data.totalAmount || 0,
          notes: result.data.notes || '',
          proposedStartDate: result.data.proposedStartDate?.split('T')[0] || '',
          proposedStartTime: result.data.proposedStartTime || '',
        })
      }
    } catch (error) {
      console.error('Failed to fetch booking:', error)
      setError('Failed to fetch booking')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      const updateData: Record<string, unknown> = {
        status: formData.status,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        notes: formData.notes || undefined,
      }

      // Only include relevant fields based on booking type
      if (booking?.type === 'pallet') {
        updateData.palletCount = formData.palletCount
      } else {
        updateData.areaSqFt = formData.areaSqFt
      }

      // Include proposed time if set
      if (formData.proposedStartDate) {
        updateData.proposedStartDate = formData.proposedStartDate
      }
      if (formData.proposedStartTime) {
        updateData.proposedStartTime = formData.proposedStartTime
      }

      // Total amount (admin can override)
      if (formData.totalAmount) {
        updateData.totalAmount = formData.totalAmount
      }

      const result = await api.patch(`/api/v1/bookings/${resolvedParams.id}`, updateData, {
        successMessage: 'Booking updated successfully',
      })

      if (result.success) {
        router.push(`/admin/bookings/${resolvedParams.id}`)
      } else {
        setError(result.error || 'Failed to update booking')
      }
    } catch (error) {
      console.error('Failed to update booking:', error)
      setError('Failed to update booking')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Booking not found</h2>
        <Link href="/admin/bookings">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bookings
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Booking</h1>
            <p className="text-sm text-muted-foreground font-mono">{booking.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/bookings/${booking.id}`}>
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>Update the booking status</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as BookingStatus })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle>Dates</CardTitle>
            <CardDescription>Booking period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Capacity */}
        <Card>
          <CardHeader>
            <CardTitle>Capacity</CardTitle>
            <CardDescription>
              {booking.type === 'pallet' ? 'Number of pallets' : 'Area in square feet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {booking.type === 'pallet' ? (
              <div className="grid gap-2">
                <Label htmlFor="palletCount">Pallet Count</Label>
                <Input
                  id="palletCount"
                  type="number"
                  min={1}
                  value={formData.palletCount}
                  onChange={(e) => setFormData({ ...formData, palletCount: parseInt(e.target.value) || 0 })}
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="areaSqFt">Area (sq ft)</Label>
                <Input
                  id="areaSqFt"
                  type="number"
                  min={1}
                  value={formData.areaSqFt}
                  onChange={(e) => setFormData({ ...formData, areaSqFt: parseInt(e.target.value) || 0 })}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Total amount (admin override)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Label htmlFor="totalAmount">Total Amount ($)</Label>
              <Input
                id="totalAmount"
                type="number"
                min={0}
                step={0.01}
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Proposed Time */}
        <Card>
          <CardHeader>
            <CardTitle>Proposed Time Slot</CardTitle>
            <CardDescription>Set a proposed date and time for the customer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="proposedStartDate">Proposed Date</Label>
              <Input
                id="proposedStartDate"
                type="date"
                value={formData.proposedStartDate}
                onChange={(e) => setFormData({ ...formData, proposedStartDate: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proposedStartTime">Proposed Time</Label>
              <Input
                id="proposedStartTime"
                type="time"
                value={formData.proposedStartTime}
                onChange={(e) => setFormData({ ...formData, proposedStartTime: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Additional notes about this booking</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Enter any notes..."
              rows={4}
            />
          </CardContent>
        </Card>
      </div>

      {/* Customer & Warehouse Info (Read Only) */}
      <Card>
        <CardHeader>
          <CardTitle>Reference Information</CardTitle>
          <CardDescription>Read-only information about this booking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Customer</Label>
              <p className="font-medium">{booking.customerName}</p>
              <p className="text-sm text-muted-foreground">{booking.customerEmail}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Warehouse</Label>
              <p className="font-medium">{booking.warehouseName || "—"}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Booking Type</Label>
              <p className="font-medium capitalize">{booking.type}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Created</Label>
              <p className="font-medium">{booking.createdAt ? new Date(booking.createdAt).toLocaleString() : "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
