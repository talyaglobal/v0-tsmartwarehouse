"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Badge } from "@/components/ui/badge"
import { Eye, Loader2, Package, Calendar, Building2 } from "@/components/icons"
import { formatCurrency, formatDate, getBookingTypeLabel } from "@/lib/utils/format"
import type { Booking, BookingStatus } from "@/types"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"

export default function WarehouseStaffBookingsPage() {
  const { user } = useUser()
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all")
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")

  // Fetch bookings for warehouse staff
  const {
    data: bookings = [],
    isLoading: bookingsLoading,
    error: bookingsError,
  } = useQuery({
    queryKey: ['warehouse-staff-bookings', user?.id, statusFilter, warehouseFilter],
    queryFn: async () => {
      if (!user?.id) return []

      let url = `/api/v1/warehouse-staff/bookings`
      const params = new URLSearchParams()
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }
      if (warehouseFilter !== "all") {
        params.append("warehouseId", warehouseFilter)
      }
      if (params.toString()) {
        url += `?${params.toString()}`
      }

      const result = await api.get<Booking[]>(url, { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  })

  // Get unique warehouses from bookings
  const warehouses = Array.from(
    new Set(bookings.map((b) => b.warehouseId))
  )

  // Filter bookings by status
  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== "all" && b.status !== statusFilter) return false
    if (warehouseFilter !== "all" && b.warehouseId !== warehouseFilter) return false
    return true
  })

  // Group bookings by status
  const preOrderBookings = filteredBookings.filter((b) => b.status === "pre_order")
  const awaitingTimeSlotBookings = filteredBookings.filter((b) => b.status === "awaiting_time_slot")
  const otherBookings = filteredBookings.filter(
    (b) => b.status !== "pre_order" && b.status !== "awaiting_time_slot"
  )

  if (bookingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (bookingsError) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load bookings. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Manage bookings for your assigned warehouses</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All
              </Button>
              <Button
                variant={statusFilter === "pre_order" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("pre_order")}
              >
                Pre-Order
              </Button>
              <Button
                variant={statusFilter === "awaiting_time_slot" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("awaiting_time_slot")}
              >
                Awaiting Time Slot
              </Button>
              <Button
                variant={statusFilter === "confirmed" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("confirmed")}
              >
                Confirmed
              </Button>
            </div>
          </div>
          {warehouses.length > 1 && (
            <div>
              <label className="text-sm font-medium mb-2 block">Warehouse</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={warehouseFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWarehouseFilter("all")}
                >
                  All Warehouses
                </Button>
                {warehouses.map((warehouseId) => (
                  <Button
                    key={warehouseId}
                    variant={warehouseFilter === warehouseId ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWarehouseFilter(warehouseId)}
                  >
                    {warehouseId.substring(0, 8)}...
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pre-Order Bookings (Priority) */}
      {preOrderBookings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pre-Order Bookings ({preOrderBookings.length})
          </h2>
          <div className="grid gap-4">
            {preOrderBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </div>
      )}

      {/* Awaiting Time Slot Bookings */}
      {awaitingTimeSlotBookings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Awaiting Time Slot ({awaitingTimeSlotBookings.length})
          </h2>
          <div className="grid gap-4">
            {awaitingTimeSlotBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </div>
      )}

      {/* Other Bookings */}
      {otherBookings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Other Bookings ({otherBookings.length})
          </h2>
          <div className="grid gap-4">
            {otherBookings.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </div>
      )}

      {filteredBookings.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No bookings found</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{booking.id}</CardTitle>
            <CardDescription>
              {booking.customerName} • {booking.customerEmail}
            </CardDescription>
          </div>
          <StatusBadge status={booking.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Type:</span>
            <Badge variant="secondary" className="ml-2">
              {getBookingTypeLabel(booking.type)}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Amount:</span>
            <span className="ml-2 font-medium">{formatCurrency(booking.totalAmount)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Start Date:</span>
            <span className="ml-2">{formatDate(booking.startDate)}</span>
          </div>
          {booking.palletCount && (
            <div>
              <span className="text-muted-foreground">Pallets:</span>
              <span className="ml-2">{booking.palletCount}</span>
            </div>
          )}
          {booking.areaSqFt && (
            <div>
              <span className="text-muted-foreground">Area:</span>
              <span className="ml-2">{booking.areaSqFt.toLocaleString()} sq ft</span>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Link href={`/warehouse/bookings/${booking.id}`}>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

