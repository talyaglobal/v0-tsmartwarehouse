"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import type { Booking } from "@/types"

interface PreOrderTimeSlotFormProps {
  booking: Booking
  onSubmit: (scheduledDatetime: string) => void
  onCancel: () => void
  isLoading?: boolean
}

export function PreOrderTimeSlotForm({
  booking,
  onSubmit,
  onCancel,
  isLoading = false,
}: PreOrderTimeSlotFormProps) {
  const [datetime, setDatetime] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!datetime) {
      setError("Please select a date and time")
      return
    }

    // Convert datetime-local format to ISO string
    const date = new Date(datetime)
    if (isNaN(date.getTime())) {
      setError("Invalid date/time")
      return
    }

    // Validate that the date is in the future
    if (date <= new Date()) {
      setError("Time slot must be in the future")
      return
    }

    // Convert to ISO string for API
    const isoString = date.toISOString()
    onSubmit(isoString)
  }

  // Format current datetime for input (YYYY-MM-DDTHH:mm)
  const getDefaultDatetime = () => {
    const now = new Date()
    now.setHours(now.getHours() + 1) // Default to 1 hour from now
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hours = String(now.getHours()).padStart(2, "0")
    const minutes = String(now.getMinutes()).padStart(2, "0")
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="datetime">Scheduled Drop-off Date & Time</Label>
        <Input
          id="datetime"
          type="datetime-local"
          value={datetime || getDefaultDatetime()}
          onChange={(e) => setDatetime(e.target.value)}
          min={new Date().toISOString().slice(0, 16)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Select when the customer should bring their pallets to the warehouse
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
        <div className="font-medium">Booking Details:</div>
        <div>
          <span className="text-muted-foreground">Customer:</span> {booking.customerName}
        </div>
        <div>
          <span className="text-muted-foreground">Type:</span>{" "}
          {booking.type === "pallet" ? `${booking.palletCount} pallets` : `${booking.areaSqFt} sq ft`}
        </div>
        <div>
          <span className="text-muted-foreground">Amount:</span> ${booking.totalAmount.toFixed(2)}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Setting..." : "Set Time Slot"}
        </Button>
      </div>
    </form>
  )
}

