"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle, Calendar, Clock, Loader2 } from "@/components/icons"
import { formatDateTime } from "@/lib/utils/format"
import { api } from "@/lib/api/client"
import { useRouter } from "next/navigation"
import type { Booking } from "@/types"

interface AcceptProposedTimeModalProps {
  booking: Booking
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AcceptProposedTimeModal({
  booking,
  open,
  onOpenChange,
}: AcceptProposedTimeModalProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const handleAccept = async () => {
    try {
      setSubmitting(true)
      const result = await api.post(
        `/api/v1/bookings/${booking.id}/accept-proposed-time`,
        {},
        {
          successMessage: "Proposed time slot accepted successfully",
          errorMessage: "Failed to accept proposed time slot",
        }
      )

      if (result.success) {
        // Check for redirectUrl in response (can be at root level or in data)
        const redirectUrl = (result as any).redirectUrl || result.data?.redirectUrl
        if (redirectUrl) {
          router.push(redirectUrl)
        } else {
          onOpenChange(false)
          router.refresh()
        }
      }
    } catch (error) {
      console.error("Failed to accept proposed time:", error)
    } finally {
      setSubmitting(false)
    }
  }

  // Handle proposedStartDate - it can be a full datetime string or just a date
  let proposedDateTime: string | null = null
  if (booking.proposedStartDate && booking.proposedStartTime) {
    // Check if proposedStartDate is already a full datetime string
    const proposedDateStr = booking.proposedStartDate
    // Normalize the time - remove seconds if present, then add :00
    const timeStr = booking.proposedStartTime
    const timeParts = timeStr.split(':')
    const normalizedTime = timeParts.length >= 2 ? `${timeParts[0]}:${timeParts[1]}:00` : `${timeStr}:00`
    
    if (proposedDateStr.includes('T') || proposedDateStr.includes(' ')) {
      // It's already a datetime, use it directly
      const date = new Date(proposedDateStr)
      if (!isNaN(date.getTime())) {
        // Extract date part and combine with time
        const dateOnly = date.toISOString().split("T")[0]
        proposedDateTime = `${dateOnly}T${normalizedTime}`
      }
    } else {
      // It's just a date string, combine with time
      proposedDateTime = `${proposedDateStr}T${normalizedTime}`
    }
  }

  if (!proposedDateTime) {
    return null
  }

  // Validate the datetime before formatting
  const dateObj = new Date(proposedDateTime)
  if (isNaN(dateObj.getTime())) {
    console.error("Invalid proposed datetime:", proposedDateTime)
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Accept Proposed Date & Time</DialogTitle>
          <DialogDescription>
            Please confirm that you can deliver your items at the proposed date and time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Proposed Date/Time Display */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-medium">Proposed Date & Time:</span>
            </div>
            <div className="flex items-center gap-2 ml-7">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg font-semibold">
                {formatDateTime(proposedDateTime)}
              </span>
            </div>
          </div>

          {/* Important Notice */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Important Notice
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  By accepting this date and time, you confirm that you will deliver your items to the warehouse at the specified date and time. 
                  Please ensure you are available and ready to drop off your items at this scheduled time.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAccept}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept & Proceed to Payment
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

