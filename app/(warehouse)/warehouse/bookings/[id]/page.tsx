"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { ArrowLeft, Package, Building2, Loader2, CheckCircle, Edit, Calendar, MapPin, FileText, User } from "@/components/icons"
import { Ruler } from "lucide-react"
import { formatDate, formatDateTime, getBookingTypeLabel } from "@/lib/utils/format"
import type { Booking } from "@/types"
import type { WarehouseSearchResult } from "@/types/marketplace"
import { api } from "@/lib/api/client"
import { StaffProposeTimeModal } from "@/components/warehouse/staff-propose-time-modal"

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

  // Fetch warehouse details
  const {
    data: warehouse,
    isLoading: warehouseLoading,
  } = useQuery({
    queryKey: ["warehouse", booking?.warehouseId],
    queryFn: async () => {
      if (!booking?.warehouseId) return null
      const result = await api.get<WarehouseSearchResult>(
        `/api/v1/warehouses/${booking.warehouseId}`,
        { showToast: false }
      )
      return result.success ? result.data : null
    },
    enabled: !!booking?.warehouseId,
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

  // Approve booking mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      const result = await api.post(
        `/api/v1/bookings/${bookingId}/approve`,
        {},
        {
          successMessage: "Booking approved successfully",
          errorMessage: "Failed to approve booking",
        }
      )
      if (!result.success) {
        throw new Error(result.error || "Failed to approve booking")
      }
      return result.data
    },
    onSuccess: () => {
      // Invalidate and refetch booking data
      queryClient.invalidateQueries({ queryKey: ["warehouse-staff-booking", bookingId] })
      queryClient.invalidateQueries({ queryKey: ["warehouse-staff-bookings"] })
      // Refetch the booking immediately
      queryClient.refetchQueries({ queryKey: ["warehouse-staff-booking", bookingId] })
      router.refresh()
    },
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
    <div className="p-4 space-y-6 pb-24">
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
                  {booking.type === "pallet"
                    ? `${booking.palletCount} pallets`
                    : `${booking.areaSqFt?.toLocaleString()} sq ft`}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Start Date</span>
              </div>
              <p className="font-semibold">{formatDate(booking.startDate)}</p>
            </div>
            {booking.endDate && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">End Date</span>
                </div>
                <p className="font-semibold">{formatDate(booking.endDate)}</p>
              </div>
            )}
          </div>

          {booking.type === "area-rental" && booking.floorNumber && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Location</span>
              </div>
              <p className="text-sm">
                Level {booking.floorNumber}
                {booking.hallId && ` - Hall ${booking.hallId.substring(0, 8)}...`}
              </p>
            </div>
          )}

          {/* Customer Requested Drop-in Time */}
          {(booking as any).metadata?.requestedDropInTime && (
            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900 dark:text-green-100">Customer Requested Drop-in Time</span>
              </div>
              <p className="font-semibold text-green-900 dark:text-green-100">
                {formatDateTime((booking as any).metadata.requestedDropInTime)}
              </p>
            </div>
          )}

          {/* Warehouse Staff Scheduled Drop-off Time */}
          {booking.scheduledDropoffDatetime && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Scheduled Drop-off (Set by Warehouse Staff)</span>
              </div>
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                {formatDateTime(booking.scheduledDropoffDatetime)}
              </p>
            </div>
          )}

          {booking.proposedStartDate && (
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Proposed Date/Time</span>
              </div>
              <p className="font-semibold text-purple-900 dark:text-purple-100">
                {formatDateTime(booking.proposedStartDate)} {booking.proposedStartTime && `- ${booking.proposedStartTime}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Details and Customer Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Booking Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <span className="text-sm font-medium">{getBookingTypeLabel(booking.type)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge status={booking.status} />
            </div>
            {booking.type === "pallet" && booking.palletCount && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pallet Count</span>
                <span className="text-sm font-medium">{booking.palletCount}</span>
              </div>
            )}
            {booking.type === "area-rental" && (
              <>
                {booking.areaSqFt && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Area</span>
                    <span className="text-sm font-medium">{booking.areaSqFt.toLocaleString()} sq ft</span>
                  </div>
                )}
                {booking.floorNumber && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Floor</span>
                    <span className="text-sm font-medium">Level {booking.floorNumber}</span>
                  </div>
                )}
                {booking.hallId && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Hall ID</span>
                    <span className="text-sm font-mono text-xs">{booking.hallId.substring(0, 8)}...</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm">{formatDate(booking.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Last Updated</span>
              <span className="text-sm">{formatDate(booking.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{booking.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium break-all">{booking.customerEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Customer ID</span>
              <span className="text-sm font-mono text-xs">{booking.customerId.substring(0, 8)}...</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warehouse Information */}
      {warehouseLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : warehouse ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Warehouse Information
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-lg">{warehouse.name}</h3>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">
                  {warehouse.address}, {warehouse.city}
                  {warehouse.state && `, ${warehouse.state}`}
                  {warehouse.zipCode && ` ${warehouse.zipCode}`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t">
              {warehouse.total_sq_ft && (
                <div className="flex items-center gap-3">
                  <Ruler className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Area</p>
                    <p className="font-semibold">
                      {warehouse.total_sq_ft.toLocaleString()} sq ft
                    </p>
                  </div>
                </div>
              )}
              {warehouse.total_pallet_storage && warehouse.total_pallet_storage > 0 && (
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pallet Storage</p>
                    <p className="font-semibold">
                      {warehouse.total_pallet_storage.toLocaleString()} pallets
                    </p>
                  </div>
                </div>
              )}
            </div>

            {warehouse.amenities && warehouse.amenities.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium mb-2">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {warehouse.amenities.slice(0, 6).map((amenity, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {amenity}
                    </Badge>
                  ))}
                  {warehouse.amenities.length > 6 && (
                    <Badge variant="secondary" className="text-xs">
                      +{warehouse.amenities.length - 6} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {warehouse.company_name && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium mb-1">Host Company</p>
                <div className="flex items-center gap-2">
                  {warehouse.company_logo && (
                    <img
                      src={warehouse.company_logo}
                      alt={warehouse.company_name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  <span className="text-sm">{warehouse.company_name}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Notes */}
      {booking.notes && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{booking.notes}</p>
          </CardContent>
        </Card>
      )}

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
                  <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
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

            {/* Staff Propose Time Modal */}
            {warehouse && (
              <StaffProposeTimeModal
                open={showDateChangeForm}
                onOpenChange={setShowDateChangeForm}
                warehouse={warehouse}
                bookingId={booking.id}
                startDate={booking.startDate}
                endDate={booking.endDate || booking.startDate}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["warehouse-staff-booking", bookingId] })
                  queryClient.invalidateQueries({ queryKey: ["warehouse-staff-bookings"] })
                }}
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
                  {formatDateTime(booking.proposedStartDate)} {booking.proposedStartTime && `- ${booking.proposedStartTime}`}
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

      {/* Pending Booking Actions */}
      {booking.status === "pending" && (
        <Card>
          <CardHeader>
            <CardTitle>Approve Booking</CardTitle>
            <CardDescription>
              Review the customer's requested date and time. If the date and time are available, approve the booking to set it to active.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show requested date/time from metadata */}
            {(booking as any).metadata?.requestedDropInTime && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Customer Requested Drop-in Time:</p>
                <p className="font-semibold">
                  {formatDateTime((booking as any).metadata.requestedDropInTime)}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex-1"
                size="lg"
              >
                {approveMutation.isPending ? (
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
              <Button
                variant="outline"
                onClick={() => setShowDateChangeForm(!showDateChangeForm)}
                className="flex-1"
                size="lg"
              >
                <Edit className="h-4 w-4 mr-2" />
                Set Another Time and Date
              </Button>
            </div>

            {/* Staff Propose Time Modal */}
            {warehouse && (
              <StaffProposeTimeModal
                open={showDateChangeForm}
                onOpenChange={setShowDateChangeForm}
                warehouse={warehouse}
                bookingId={booking.id}
                startDate={booking.startDate}
                endDate={booking.endDate || booking.startDate}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["warehouse-staff-booking", bookingId] })
                  queryClient.invalidateQueries({ queryKey: ["warehouse-staff-bookings"] })
                }}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
