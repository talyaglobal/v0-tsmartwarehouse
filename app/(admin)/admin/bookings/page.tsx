"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Package, Building2, Eye, Loader2, CheckCircle2 as CheckCircle, AlertCircle } from "lucide-react"
import { formatCurrency, formatDate, formatNumber, getBookingTypeLabel } from "@/lib/utils/format"
import { api } from "@/lib/api/client"
import type { Booking } from "@/types"

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingBookingId, setApprovingBookingId] = useState<string | null>(null)
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/bookings')
      if (response.ok) {
        const data = await response.json()
        setBookings(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  // Approve booking mutation
  const approveBookingMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const result = await api.post(
        `/api/v1/bookings/${bookingId}/approve`,
        {},
        { successMessage: 'Booking approved successfully' }
      )
      if (!result.success) {
        throw new Error(result.error || 'Failed to approve booking')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      fetchBookings() // Refresh bookings list
      setApprovalDialogOpen(false)
      setSelectedBooking(null)
      setApprovingBookingId(null)
    },
    onError: (error) => {
      console.error('Failed to approve booking:', error)
    },
  })

  const handleApproveClick = (booking: Booking) => {
    setSelectedBooking(booking)
    setApprovalDialogOpen(true)
  }

  const handleApproveConfirm = () => {
    if (selectedBooking) {
      setApprovingBookingId(selectedBooking.id)
      approveBookingMutation.mutate(selectedBooking.id)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const activeBookings = bookings.filter((b) => b.status === "active")
  const pendingBookings = bookings.filter((b) => b.status === "pending")
  const totalValue = bookings.reduce((sum, b) => sum + b.totalAmount, 0)
  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="Manage all warehouse bookings">
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{bookings.length}</div>
            <p className="text-xs text-muted-foreground">Total Bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{activeBookings.length}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{pendingBookings.length}</div>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">Total Value</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
          <CardDescription>View and manage customer bookings</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No bookings found
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{booking.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{booking.customerName}</p>
                      <p className="text-xs text-muted-foreground">{booking.customerEmail}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {booking.type === "pallet" ? (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      )}
                      {getBookingTypeLabel(booking.type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {booking.type === "pallet"
                      ? `${booking.palletCount} pallets`
                      : `${formatNumber(booking.areaSqFt || 0)} sq ft (L3)`}
                  </TableCell>
                  <TableCell>{formatDate(booking.startDate)}</TableCell>
                  <TableCell>{formatCurrency(booking.totalAmount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={booking.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {booking.status === 'pending' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApproveClick(booking)}
                          disabled={approveBookingMutation.isPending && approvingBookingId === booking.id}
                        >
                          {approveBookingMutation.isPending && approvingBookingId === booking.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Approving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </>
                          )}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this booking? This will reserve capacity and generate an invoice.
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Customer:</span>
                  <span className="text-sm font-medium">{selectedBooking.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Type:</span>
                  <span className="text-sm font-medium">{getBookingTypeLabel(selectedBooking.type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Details:</span>
                  <span className="text-sm font-medium">
                    {selectedBooking.type === "pallet"
                      ? `${selectedBooking.palletCount} pallets`
                      : `${formatNumber(selectedBooking.areaSqFt || 0)} sq ft`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Start Date:</span>
                  <span className="text-sm font-medium">{formatDate(selectedBooking.startDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Amount:</span>
                  <span className="text-sm font-medium">{formatCurrency(selectedBooking.totalAmount)}</span>
                </div>
              </div>
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-medium">Capacity Check</p>
                    <p className="text-xs mt-1">
                      Capacity will be checked before approval. If insufficient capacity is available, approval will fail.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApprovalDialogOpen(false)}
              disabled={approveBookingMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveConfirm}
              disabled={approveBookingMutation.isPending}
            >
              {approveBookingMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Booking
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
