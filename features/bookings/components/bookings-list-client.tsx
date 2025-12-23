/**
 * Bookings List Client Component
 * Handles interactivity for bookings list
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Package, Building2, Calendar } from '@/components/icons'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { cancelBookingAction } from '../actions'
import { useUIStore } from '@/stores/ui.store'
import type { Booking } from '@/types'

interface BookingsListClientProps {
  bookings: Booking[]
}

export function BookingsListClient({ bookings }: BookingsListClientProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const addNotification = useUIStore((state) => state.addNotification)

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return
    }

    setCancellingId(bookingId)
    try {
      const result = await cancelBookingAction(bookingId)
      if (result.success) {
        addNotification({
          type: 'success',
          message: 'Booking cancelled successfully',
        })
        // Revalidate will happen automatically via Server Action
      } else {
        addNotification({
          type: 'error',
          message: result.error || 'Failed to cancel booking',
        })
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'An unexpected error occurred',
      })
    } finally {
      setCancellingId(null)
    }
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No bookings found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {bookings.map((booking) => (
        <Card key={booking.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {booking.type === 'pallet' ? (
                  <Package className="h-5 w-5 text-primary" />
                ) : (
                  <Building2 className="h-5 w-5 text-primary" />
                )}
                <CardTitle className="text-lg">
                  {booking.type === 'pallet'
                    ? `Pallet Storage - ${booking.palletCount} pallets`
                    : `Area Rental - ${booking.areaSqFt} sq ft`}
                </CardTitle>
              </div>
              <StatusBadge status={booking.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="text-sm font-medium">
                    {formatDate(booking.startDate)}
                  </p>
                </div>
              </div>
              {booking.endDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="text-sm font-medium">
                      {formatDate(booking.endDate)}
                    </p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-sm font-medium">
                  {formatCurrency(booking.totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Warehouse</p>
                <p className="text-sm font-medium">{booking.warehouseId}</p>
              </div>
            </div>
            {booking.notes && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{booking.notes}</p>
              </div>
            )}
            {booking.status !== 'cancelled' && booking.status !== 'completed' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(booking.id)}
                  disabled={cancellingId === booking.id}
                >
                  {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

