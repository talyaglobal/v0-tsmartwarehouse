"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { ArrowLeft, Package, Building2, Calendar, User, Clock, Edit, Trash, Loader2, AlertCircle } from "@/components/icons"
import { formatCurrency, formatDate, formatNumber, getBookingTypeLabel } from "@/lib/utils/format"
import { api } from "@/lib/api/client"
import type { Booking } from "@/types"
import { RootTestDataBadge } from "@/components/ui/root-test-data-badge"
import { getRootUserIds, isTestDataSync } from "@/lib/utils/test-data"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [rootUserIds, setRootUserIds] = useState<string[]>([])

  useEffect(() => {
    fetchBooking()
    getRootUserIds().then(setRootUserIds)
  }, [resolvedParams.id])

  const fetchBooking = async () => {
    try {
      setLoading(true)
      const result = await api.get(`/api/v1/bookings/${resolvedParams.id}`, { showToast: false })
      if (result.success && result.data) {
        setBooking(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch booking:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setDeleting(true)
      const result = await api.delete(`/api/v1/bookings/${resolvedParams.id}`, {
        successMessage: 'Booking deleted successfully',
      })
      if (result.success) {
        router.push('/admin/bookings')
      }
    } catch (error) {
      console.error('Failed to delete booking:', error)
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
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
        <p className="text-muted-foreground">The booking you're looking for doesn't exist or has been deleted.</p>
        <Link href="/admin/bookings">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bookings
          </Button>
        </Link>
      </div>
    )
  }

  const isTestData = isTestDataSync(booking.customerId, rootUserIds)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Booking Details</h1>
              {isTestData && <RootTestDataBadge size="sm" />}
            </div>
            <p className="text-sm text-muted-foreground font-mono">{booking.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={booking.status} />
          <Link href={`/admin/bookings/${booking.id}/edit`}>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{booking.customerName || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{booking.customerEmail || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer ID</span>
              <span className="font-medium font-mono text-xs">{booking.customerId?.slice(0, 8)}...</span>
            </div>
          </CardContent>
        </Card>

        {/* Warehouse Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Warehouse Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Warehouse</span>
              <span className="font-medium">{booking.warehouseName || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Warehouse ID</span>
              <span className="font-medium font-mono text-xs">{booking.warehouseId?.slice(0, 8)}...</span>
            </div>
          </CardContent>
        </Card>

        {/* Booking Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Booking Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <div className="flex items-center gap-2">
                {booking.type === "pallet" ? (
                  <Package className="h-4 w-4" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                <span className="font-medium">{getBookingTypeLabel(booking.type)}</span>
              </div>
            </div>
            {booking.type === "pallet" ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pallet Count</span>
                <span className="font-medium">{booking.palletCount} pallets</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Area</span>
                <span className="font-medium">{formatNumber(booking.areaSqFt || 0)} sq ft</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={booking.status} />
            </div>
          </CardContent>
        </Card>

        {/* Dates & Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Dates & Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium">{formatDate(booking.startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">End Date</span>
              <span className="font-medium">{booking.endDate ? formatDate(booking.endDate) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-medium text-lg">{formatCurrency(booking.totalAmount || 0)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Time Slot Information */}
        {(booking.proposedStartDate || booking.proposedStartTime) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time Slot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {booking.proposedStartDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proposed Date</span>
                  <span className="font-medium">{formatDate(booking.proposedStartDate)}</span>
                </div>
              )}
              {booking.proposedStartTime && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proposed Time</span>
                  <span className="font-medium">{booking.proposedStartTime}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created At</span>
              <span className="font-medium">{booking.createdAt ? formatDate(booking.createdAt) : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated At</span>
              <span className="font-medium">{booking.updatedAt ? formatDate(booking.updatedAt) : "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {booking.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{booking.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this booking? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200">
                <p className="font-medium">Warning</p>
                <p className="text-xs mt-1">
                  Deleting booking for {booking.customerName} - {formatCurrency(booking.totalAmount)}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
