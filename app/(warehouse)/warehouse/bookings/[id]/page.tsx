"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { ArrowLeft, Package, Building2, Loader2, CheckCircle, Edit } from "@/components/icons"
import { formatDate, formatDateTime, getBookingTypeLabel } from "@/lib/utils/format"
import type { Booking } from "@/types"
import { api } from "@/lib/api/client"
import { BookingDateChangeForm } from "@/components/warehouse/booking-date-change-form"

export default function WarehouseStaffBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [bookingId, setBookingId] = useState<string>("")
  const [showDateChangeForm, setShowDateChangeForm] = useState(false)

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = params instanceof Promise ? await params : params
      setBookingId(resolvedParams.id)
    }
    resolveParams()
  }, [params])

  // Fetch booking
  const {
    data: booking,
    isLoading: bookingLoading,
    error: bookingError,
  } = useQuery({
    queryKey: ["warehouse-staff-booking", bookingId],
    queryFn: async () => {
      if (!bookingId) return null
      const result = await api.get<Booking>(`/api/v1/bookings/${bookingId}`, {
        showToast: false,
      })
      return result.success ? result.data : null
    },
    enabled: !!bookingId,
  })

  // Fetch availability for requested date
  const {
    data: availability,
    isLoading: availabilityLoading,
  } = useQuery({
    queryKey: ["availability", booking?.warehouseId, booking?.startDate],
    queryFn: async () => {
      if (!booking?.warehouseId || !booking?.startDate) return null
      const date = booking.startDate.split("T")[0]
      const result = await api.get<{
        date: string
        timeSlots: Array<{ time: string; available: boolean }>
      }>(`/api/v1/warehouses/${booking.warehouseId}/availability?date=${date}`, {
        showToast: false,
      })
      return result.success ? result.data : null
    },
    enabled: !!booking?.warehouseId && !!booking?.startDate && booking.status === "pre_order",
  })

  // Set awaiting time slot mutation
  const setAwaitingMutation = useMutation({
    mutationFn: async () => {
      const result = await api.post(
        `/api/v1/bookings/${bookingId}/set-awaiting-time-slot`,
        {},
        {
          successMessage: "Booking status updated successfully",
          errorMessage: "Failed to update booking status",
        }
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to update status")
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-staff-booking", bookingId] })
      queryClient.invalidateQueries({ queryKey: ["warehouse-staff-bookings"] })
    },
  })

  // Check if requested date/time is available
  const isRequestedDateAvailable =
    availability?.timeSlots?.some((slot) => slot.available) ?? false

  if (bookingLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (bookingError || !booking) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Booking Not Found</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              The booking you're looking for doesn't exist or you don't have permission to view it.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Booking Details</h1>
          <p className="text-sm text-muted-foreground">Booking ID: {booking.id}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Booking Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {booking.type === "pallet" ? (
                <Package className="h-8 w-8 text-primary" />
              ) : (
                <Building2 className="h-8 w-8 text-primary" />
              )}
              <div>
                <CardTitle>{getBookingTypeLabel(booking.type)}</CardTitle>
                <CardDescription>
                  {booking.customerName} • {booking.customerEmail}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Start Date</span>
              <p className="text-lg font-semibold">{formatDate(booking.startDate)}</p>
            </div>
            {booking.palletCount && (
              <div>
                <span className="text-sm text-muted-foreground">Pallets</span>
                <p className="text-lg font-semibold">{booking.palletCount}</p>
              </div>
            )}
            {booking.areaSqFt && (
              <div>
                <span className="text-sm text-muted-foreground">Area</span>
                <p className="text-lg font-semibold">{booking.areaSqFt.toLocaleString()} sq ft</p>
              </div>
            )}
            {booking.scheduledDropoffDatetime && (
              <div>
                <span className="text-sm text-muted-foreground">Scheduled Drop-off</span>
                <p className="text-lg font-semibold">
                  {formatDateTime(booking.scheduledDropoffDatetime)}
                </p>
              </div>
            )}
            {booking.proposedStartDate && (
              <div>
                <span className="text-sm text-muted-foreground">Proposed Date/Time</span>
                <p className="text-lg font-semibold">
                  {formatDateTime(booking.proposedStartDate)} {booking.proposedStartTime}
                </p>
              </div>
            )}
          </div>
          {booking.notes && (
            <div>
              <span className="text-sm text-muted-foreground">Notes</span>
              <p className="mt-1">{booking.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions for Pre-Order Bookings */}
      {booking.status === "pre_order" && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>
              Review the requested date and time. If available, set the booking to awaiting time slot. If not, propose a different date/time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Availability Status */}
            {availabilityLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium mb-2">Requested Date Availability</p>
                {isRequestedDateAvailable ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Available
                  </Badge>
                ) : (
                  <Badge variant="destructive">Not Available</Badge>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isRequestedDateAvailable && (
                <Button
                  onClick={() => setAwaitingMutation.mutate()}
                  disabled={setAwaitingMutation.isPending}
                >
                  {setAwaitingMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Set Awaiting Time Slot
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowDateChangeForm(!showDateChangeForm)}
              >
                <Edit className="h-4 w-4 mr-2" />
                {showDateChangeForm ? "Cancel" : "Change Date/Time"}
              </Button>
            </div>

            {/* Date Change Form */}
            {showDateChangeForm && (
              <BookingDateChangeForm
                bookingId={booking.id}
                warehouseId={booking.warehouseId}
                requestedDate={booking.startDate}
                onSuccess={() => {
                  setShowDateChangeForm(false)
                  queryClient.invalidateQueries({ queryKey: ["warehouse-staff-booking", bookingId] })
                }}
                onCancel={() => setShowDateChangeForm(false)}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Awaiting Time Slot Status */}
      {booking.status === "awaiting_time_slot" && (
        <Card>
          <CardHeader>
            <CardTitle>Awaiting Customer Action</CardTitle>
            <CardDescription>
              This booking is waiting for the customer to select a time slot.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {booking.proposedStartDate ? (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Proposed Date/Time:</p>
                <p className="font-medium">
                  {formatDateTime(booking.proposedStartDate)} {booking.proposedStartTime}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Customer needs to select a time slot for the requested date.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

