"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Clock, Package } from "lucide-react"
import { formatCurrency, formatDate, formatNumber, getBookingTypeLabel } from "@/lib/utils/format"
import { api } from "@/lib/api/client"
import type { Booking } from "@/types"
import { PreOrderTimeSlotForm } from "@/components/admin/pre-order-time-slot-form"

export default function PreOrdersPage() {
  const [preOrders, setPreOrders] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [timeSlotDialogOpen, setTimeSlotDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    fetchPreOrders()
  }, [])

  const fetchPreOrders = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/bookings?status=pre_order')
      if (response.ok) {
        const data = await response.json()
        setPreOrders(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch pre-orders:', error)
    } finally {
      setLoading(false)
    }
  }

  // Set time slot mutation
  const setTimeSlotMutation = useMutation({
    mutationFn: async ({ bookingId, scheduledDatetime }: { bookingId: string; scheduledDatetime: string }) => {
      const result = await api.post(
        `/api/v1/bookings/${bookingId}/set-time-slot`,
        { scheduledDatetime },
        { successMessage: 'Time slot set successfully' }
      )
      if (!result.success) {
        throw new Error(result.error || 'Failed to set time slot')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      fetchPreOrders() // Refresh pre-orders list
      setTimeSlotDialogOpen(false)
      setSelectedBooking(null)
    },
    onError: (error) => {
      console.error('Failed to set time slot:', error)
    },
  })

  const handleSetTimeSlotClick = (booking: Booking) => {
    setSelectedBooking(booking)
    setTimeSlotDialogOpen(true)
  }

  const handleTimeSlotSubmit = (scheduledDatetime: string) => {
    if (selectedBooking) {
      setTimeSlotMutation.mutate({
        bookingId: selectedBooking.id,
        scheduledDatetime,
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const awaitingTimeSlot = preOrders.filter((b) => !b.scheduledDropoffDatetime)
  const withTimeSlot = preOrders.filter((b) => b.scheduledDropoffDatetime && !b.timeSlotConfirmedAt)
  const confirmedTimeSlots = preOrders.filter((b) => b.timeSlotConfirmedAt)

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Pre-Orders" 
        description="Manage pre-orders and assign time slots for pallet drop-offs"
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{awaitingTimeSlot.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting Time Slot</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{withTimeSlot.length}</div>
            <p className="text-xs text-muted-foreground">Time Slot Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{confirmedTimeSlots.length}</div>
            <p className="text-xs text-muted-foreground">Time Slot Confirmed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pre-Orders</CardTitle>
          <CardDescription>Review and assign time slots for customer pre-orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Time Slot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No pre-orders found
                  </TableCell>
                </TableRow>
              ) : (
                preOrders.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-mono text-xs">{booking.id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{booking.customerName}</div>
                        <div className="text-xs text-muted-foreground">{booking.customerEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={booking.type === "pallet" ? "default" : "secondary"}>
                        {getBookingTypeLabel(booking.type)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      {booking.type === "pallet" ? (
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {formatNumber(booking.palletCount || 0)} pallets
                        </div>
                      ) : (
                        <div>{formatNumber(booking.areaSqFt || 0)} sq ft</div>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(booking.totalAmount)}</TableCell>
                    <TableCell>
                      {booking.scheduledDropoffDatetime ? (
                        <div>
                          <div className="font-medium">
                            {formatDate(booking.scheduledDropoffDatetime, { includeTime: true })}
                          </div>
                          {booking.timeSlotConfirmedAt && (
                            <div className="text-xs text-green-600">Confirmed</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status="warning">Pre-Order</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      {!booking.scheduledDropoffDatetime ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetTimeSlotClick(booking)}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Set Time Slot
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {booking.timeSlotConfirmedAt ? "Awaiting Payment" : "Awaiting Confirmation"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Time Slot Dialog */}
      <Dialog open={timeSlotDialogOpen} onOpenChange={setTimeSlotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Time Slot</DialogTitle>
            <DialogDescription>
              Assign a scheduled drop-off time for this pre-order
            </DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <PreOrderTimeSlotForm
              booking={selectedBooking}
              onSubmit={handleTimeSlotSubmit}
              onCancel={() => setTimeSlotDialogOpen(false)}
              isLoading={setTimeSlotMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

