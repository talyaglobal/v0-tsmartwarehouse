"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { StatusBadge } from "@/components/ui/status-badge"
import { Loader2, Clock, CheckCircle2, Package } from "lucide-react"
import { formatCurrency, formatDate, formatNumber, getBookingTypeLabel } from "@/lib/utils/format"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import type { Booking } from "@/types"
import { PreOrderStatusCard } from "@/components/bookings/pre-order-status-card"

export default function PreOrdersPage() {
  const { user, isLoading: userLoading } = useUser()
  const queryClient = useQueryClient()

  // Fetch pre-orders
  const {
    data: preOrders = [],
    isLoading: preOrdersLoading,
    error: preOrdersError,
  } = useQuery({
    queryKey: ['pre-orders', user?.id],
    queryFn: async () => {
      if (!user) return []
      const result = await api.get<Booking[]>(`/api/v1/bookings?status=pre_order&customerId=${user.id}`, { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!user && !userLoading,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  })

  // Confirm time slot mutation
  const confirmTimeSlotMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const result = await api.post(
        `/api/v1/bookings/${bookingId}/confirm-time-slot`,
        {},
        { successMessage: 'Time slot confirmed successfully' }
      )
      if (!result.success) {
        throw new Error(result.error || 'Failed to confirm time slot')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre-orders'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    },
  })

  const handleConfirmTimeSlot = (bookingId: string) => {
    confirmTimeSlotMutation.mutate(bookingId)
  }

  if (userLoading || preOrdersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (preOrdersError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Failed to load pre-orders. Please try again.</p>
      </div>
    )
  }

  const awaitingTimeSlot = preOrders.filter((b) => !b.scheduledDropoffDatetime)
  const timeSlotAssigned = preOrders.filter((b) => b.scheduledDropoffDatetime && !b.timeSlotConfirmedAt)
  const timeSlotConfirmed = preOrders.filter((b) => b.timeSlotConfirmedAt)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pre-Orders"
        description="View and manage your pre-orders and scheduled drop-off times"
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
            <div className="text-2xl font-bold">{timeSlotAssigned.length}</div>
            <p className="text-xs text-muted-foreground">Time Slot Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{timeSlotConfirmed.length}</div>
            <p className="text-xs text-muted-foreground">Ready for Payment</p>
          </CardContent>
        </Card>
      </div>

      {/* Pre-Orders List */}
      {preOrders.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pre-orders found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {preOrders.map((booking) => (
            <PreOrderStatusCard
              key={booking.id}
              booking={booking}
              onConfirmTimeSlot={handleConfirmTimeSlot}
              isConfirming={confirmTimeSlotMutation.isPending && confirmTimeSlotMutation.variables === booking.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

