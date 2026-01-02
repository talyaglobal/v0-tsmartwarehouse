"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, Package, Building2, Calendar } from "lucide-react"
import { formatCurrency, formatDate, formatDateTime, formatNumber, getBookingTypeLabel } from "@/lib/utils/format"
import Link from "next/link"
import type { Booking } from "@/types"

interface PreOrderStatusCardProps {
  booking: Booking
  onConfirmTimeSlot: (bookingId: string) => void
  isConfirming?: boolean
}

export function PreOrderStatusCard({
  booking,
  onConfirmTimeSlot,
  isConfirming = false,
}: PreOrderStatusCardProps) {
  const hasTimeSlot = !!booking.scheduledDropoffDatetime
  const isConfirmed = !!booking.timeSlotConfirmedAt

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pre-Order #{booking.id.slice(0, 8)}
            </CardTitle>
            <CardDescription className="mt-1">
              {getBookingTypeLabel(booking.type)} • {formatCurrency(booking.totalAmount)}
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Pre-Order</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Booking Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Type</div>
            <div className="font-medium">
              {booking.type === "pallet" ? (
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {formatNumber(booking.palletCount || 0)} pallets
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {formatNumber(booking.areaSqFt || 0)} sq ft
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Total Amount</div>
            <div className="font-medium">{formatCurrency(booking.totalAmount)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Start Date</div>
            <div className="font-medium">{formatDate(booking.startDate)}</div>
          </div>
          {booking.endDate && (
            <div>
              <div className="text-muted-foreground">End Date</div>
              <div className="font-medium">{formatDate(booking.endDate)}</div>
            </div>
          )}
        </div>

        {/* Time Slot Status */}
        <div className="border-t pt-4">
          {!hasTimeSlot ? (
            <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <div className="flex-1">
                <div className="font-medium text-yellow-900 dark:text-yellow-100">
                  Awaiting Time Slot Assignment
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  Warehouse will assign a drop-off time slot for your pallets. You will be notified when it's ready.
                </div>
              </div>
            </div>
          ) : !isConfirmed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div className="flex-1">
                  <div className="font-medium text-blue-900 dark:text-blue-100">
                    Time Slot Assigned
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    Scheduled: {formatDateTime(booking.scheduledDropoffDatetime!)}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => onConfirmTimeSlot(booking.id)}
                disabled={isConfirming}
                className="w-full"
              >
                {isConfirming ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm Time Slot
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <div className="font-medium text-green-900 dark:text-green-100">
                    Time Slot Confirmed
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    Scheduled: {formatDateTime(booking.scheduledDropoffDatetime!)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link href={`/payment?bookingId=${booking.id}`}>
                    Proceed to Payment
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

