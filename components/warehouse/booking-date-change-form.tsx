"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Clock } from "@/components/icons"
import { api } from "@/lib/api/client"
import type { TimeSlot } from "@/lib/business-logic/availability"

interface BookingDateChangeFormProps {
  bookingId: string
  warehouseId: string
  requestedDate: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function BookingDateChangeForm({
  bookingId,
  warehouseId,
  requestedDate,
  onSuccess,
  onCancel,
}: BookingDateChangeFormProps) {
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [reason, setReason] = useState<string>("")
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load available time slots when date is selected
  const handleDateChange = async (date: string) => {
    setSelectedDate(date)
    setSelectedTime("")
    if (!date) {
      setAvailableTimeSlots([])
      return
    }

    try {
      setLoadingSlots(true)
      const result = await api.get<{
        date: string
        timeSlots: TimeSlot[]
        availableCount: number
        totalCount: number
      }>(`/api/v1/warehouses/${warehouseId}/availability?date=${date}`, {
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
        `/api/v1/bookings/${bookingId}/propose-date-change`,
        {
          proposedStartDate: selectedDate,
          proposedStartTime: selectedTime,
          reason: reason || undefined,
        },
        {
          successMessage: "Date/time change proposed successfully",
          errorMessage: "Failed to propose date/time change",
        }
      )

      if (result.success) {
        onSuccess?.()
      }
    } catch (error) {
      console.error("Failed to propose date change:", error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Propose Date/Time Change</CardTitle>
        <CardDescription>
          Select a new date and time for this booking. The customer will be notified and can confirm or request a different time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="date">New Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              required
            />
            <p className="text-sm text-muted-foreground mt-1">
              Requested date: {new Date(requestedDate).toLocaleDateString()}
            </p>
          </div>

          {selectedDate && (
            <div>
              <Label>Available Time Slots</Label>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {availableTimeSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      type="button"
                      variant={selectedTime === slot.time ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={!slot.available ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      {slot.time}
                    </Button>
                  ))}
                </div>
              )}
              {availableTimeSlots.length === 0 && !loadingSlots && (
                <p className="text-sm text-muted-foreground mt-2">
                  No available time slots for this date
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the date/time needs to be changed..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={!selectedDate || !selectedTime || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Propose Change"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

