"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, X, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TimeSlot } from "@/types"

interface TimeSlotInputProps {
  onTimeSlotsChange: (timeSlots: TimeSlot[]) => void
  initialTimeSlots?: TimeSlot[]
  label?: string
  description?: string
}

export function TimeSlotInput({
  onTimeSlotsChange,
  initialTimeSlots = [],
  label = "Time Slots",
  description = "Add time slots for product acceptance or departure",
}: TimeSlotInputProps) {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(initialTimeSlots)
  const [errors, setErrors] = useState<Record<number, string>>({})

  useEffect(() => {
    setTimeSlots(initialTimeSlots)
  }, [initialTimeSlots])

  const validateTimeSlot = (slot: TimeSlot, index: number): string | null => {
    // Validate time format (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    
    if (!slot.start || !slot.end) {
      return "Start and end times are required"
    }

    if (!timeRegex.test(slot.start) || !timeRegex.test(slot.end)) {
      return "Time must be in HH:mm format (e.g., 08:00)"
    }

    // Convert to minutes for comparison
    const [startHours, startMinutes] = slot.start.split(":").map(Number)
    const [endHours, endMinutes] = slot.end.split(":").map(Number)
    const startTotal = startHours * 60 + startMinutes
    const endTotal = endHours * 60 + endMinutes

    if (startTotal >= endTotal) {
      return "End time must be after start time"
    }

    // Check for overlaps with other slots
    for (let i = 0; i < timeSlots.length; i++) {
      if (i === index) continue

      const otherSlot = timeSlots[i]
      const [otherStartHours, otherStartMinutes] = otherSlot.start.split(":").map(Number)
      const [otherEndHours, otherEndMinutes] = otherSlot.end.split(":").map(Number)
      const otherStartTotal = otherStartHours * 60 + otherStartMinutes
      const otherEndTotal = otherEndHours * 60 + otherEndMinutes

      // Check if slots overlap
      if (
        (startTotal >= otherStartTotal && startTotal < otherEndTotal) ||
        (endTotal > otherStartTotal && endTotal <= otherEndTotal) ||
        (startTotal <= otherStartTotal && endTotal >= otherEndTotal)
      ) {
        return `This slot overlaps with another slot (${otherSlot.start} - ${otherSlot.end})`
      }
    }

    return null
  }

  const handleAddSlot = () => {
    const newSlot: TimeSlot = { start: "08:00", end: "12:00" }
    const newSlots = [...timeSlots, newSlot]
    setTimeSlots(newSlots)
    onTimeSlotsChange(newSlots)
  }

  const handleRemoveSlot = (index: number) => {
    const newSlots = timeSlots.filter((_, i) => i !== index)
    setTimeSlots(newSlots)
    setErrors((prev) => {
      const newErrors = { ...prev }
      delete newErrors[index]
      // Re-index errors
      const reindexed: Record<number, string> = {}
      Object.keys(newErrors).forEach((key) => {
        const oldIndex = Number(key)
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = newErrors[oldIndex]
        } else {
          reindexed[oldIndex] = newErrors[oldIndex]
        }
      })
      return reindexed
    })
    onTimeSlotsChange(newSlots)
  }

  const handleTimeChange = (index: number, field: "start" | "end", value: string) => {
    const newSlots = [...timeSlots]
    newSlots[index] = { ...newSlots[index], [field]: value }
    setTimeSlots(newSlots)

    // Validate the updated slot
    const error = validateTimeSlot(newSlots[index], index)
    if (error) {
      setErrors((prev) => ({ ...prev, [index]: error }))
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[index]
        return newErrors
      })
    }

    onTimeSlotsChange(newSlots)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>{label}</Label>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      {timeSlots.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No time slots added. Click "Add Time Slot" to add one.
          </AlertDescription>
        </Alert>
      )}

      {timeSlots.map((slot, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`start-${index}`}>Start Time</Label>
                  <Input
                    id={`start-${index}`}
                    type="time"
                    value={slot.start}
                    onChange={(e) => handleTimeChange(index, "start", e.target.value)}
                    className={errors[index] ? "border-destructive" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`end-${index}`}>End Time</Label>
                  <Input
                    id={`end-${index}`}
                    type="time"
                    value={slot.end}
                    onChange={(e) => handleTimeChange(index, "end", e.target.value)}
                    className={errors[index] ? "border-destructive" : ""}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveSlot(index)}
                className="mt-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {errors[index] && (
              <p className="text-sm text-destructive mt-2">{errors[index]}</p>
            )}
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={handleAddSlot}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Time Slot
      </Button>
    </div>
  )
}

