"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, Clock, CheckCircle } from "@/components/icons"
import { formatDateTime } from "@/lib/utils/format"
import { api } from "@/lib/api/client"
import type { Booking } from "@/types"

interface TimeSlot {
  time: string
  available: boolean
  reason?: string
}

interface TimeSlotSelectionModalProps {
  booking: Booking
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TimeSlotSelectionModal({
  booking,
  open,
  onOpenChange,
}: TimeSlotSelectionModalProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Initialize with proposed date or requested date
  useEffect(() => {
    if (booking.proposedStartDate) {
      const date = new Date(booking.proposedStartDate).toISOString().split("T")[0]
      setSelectedDate(date)
      if (booking.proposedStartTime) {
        setSelectedTime(booking.proposedStartTime)
      }
    } else if (booking.startDate) {
      const date = new Date(booking.startDate).toISOString().split("T")[0]
      setSelectedDate(date)
    }
  }, [booking])

  // Load available time slots when date is selected
  useEffect(() => {
    if (selectedDate && booking.warehouseId) {
      loadTimeSlots(selectedDate)
    }
  }, [selectedDate, booking.warehouseId])

  const loadTimeSlots = async (date: string) => {
    try {
      setLoadingSlots(true)
      const result = await api.get<{
        date: string
        timeSlots: TimeSlot[]
        availableCount: number
        totalCount: number
      }>(`/api/v1/warehouses/${booking.warehouseId}/availability?date=${date}`, {
        showToast: false,
      })

      if (result.success && result.data) {
        setAvailableTimeSlots(result.data.timeSlots || [])
      }
    } catch (error) {
      console.error("Failed to load time slots:", error)
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedDate || !selectedTime) {
      return
    }

    try {
      setSubmitting(true)
      const result = await api.post(
        `/api/v1/bookings/${booking.id}/select-time-slot`, {
          selectedDate,
          selectedTime,
        },
        {
          successMessage: "Time slot selected successfully",
          errorMessage: "Failed to select time slot",
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
      console.error("Failed to select time slot:", error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Time Slot</DialogTitle>
          <DialogDescription>
            Choose a date and time for your booking drop-off. Available time slots are shown below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Proposed Date/Time Info */}
          {booking.proposedStartDate && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Warehouse Staff Proposed:</p>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(booking.proposedStartDate)} {booking.proposedStartTime}
              </p>
            </div>
          )}

          {/* Date Selection */}
          <div>
            <Label htmlFor="date">Select Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              required
              className="mt-2"
            />
          </div>

          {/* Time Slot Selection */}
          {selectedDate && (
            <div>
              <Label>Select Time Slot</Label>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {availableTimeSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      type="button"
                      variant={selectedTime === slot.time ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={
                        !slot.available
                          ? "opacity-50 cursor-not-allowed"
                          : selectedTime === slot.time
                          ? "bg-primary text-primary-foreground"
                          : ""
                      }
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      {slot.time}
                    </Button>
                  ))}
                </div>
              )}
              {availableTimeSlots.length === 0 && !loadingSlots && (
                <p className="text-sm text-muted-foreground mt-2 text-center py-4">
                  No available time slots for this date. Please select a different date.
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedDate || !selectedTime || submitting || loadingSlots}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Select & Proceed to Payment
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

