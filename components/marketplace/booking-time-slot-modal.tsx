"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, Clock, Loader2, Info, ChevronLeft, ChevronRight } from "lucide-react"
import { formatDate } from "@/lib/utils/format"
import { BookingSummary } from "./booking-summary"
import { api } from "@/lib/api/client"
import type { WarehouseSearchResult } from "@/types/marketplace"

interface BookingTimeSlotModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouse: WarehouseSearchResult
  type: "pallet" | "area-rental"
  quantity: number
  startDate: string
  endDate: string
  onConfirm: (selectedDate: string, selectedTime: string) => Promise<void>
  // Legacy props - kept for backwards compatibility but not used
  selectedServices?: string[]
  onServicesChange?: (serviceIds: string[]) => void
}

interface TimeSlot {
  time: string
  available: boolean
}

interface DayAvailability {
  date: string
  dayName: string
  isAvailable: boolean
  timeSlots: TimeSlot[]
}

export function BookingTimeSlotModal({
  open,
  onOpenChange,
  warehouse,
  type,
  quantity,
  startDate,
  endDate,
  onConfirm,
}: BookingTimeSlotModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [dayAvailabilities, setDayAvailabilities] = useState<DayAvailability[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false)

  // Generate day availabilities
  useEffect(() => {
    if (!open || !startDate || !endDate) return

    const generateDays = () => {
      const days: DayAvailability[] = []
      const start = new Date(startDate)
      const end = new Date(endDate)
      const current = new Date(start)

      const workingDays = warehouse.working_days || warehouse.operating_hours?.days || []

      while (current <= end) {
        const dateString = current.toISOString().split("T")[0]
        const dayName = current.toLocaleDateString("en-US", { weekday: "long" })
        
        // Check if this day is a working day
        const isWorkingDay = workingDays.length === 0 || workingDays.includes(dayName)
        
        days.push({
          date: dateString,
          dayName,
          isAvailable: isWorkingDay,
          timeSlots: [], // Will be loaded when date is selected
        })

        current.setDate(current.getDate() + 1)
      }

      setDayAvailabilities(days)
      // Auto-select first available date
      const firstAvailable = days.find((d) => d.isAvailable)
      if (firstAvailable) {
        setSelectedDate(firstAvailable.date)
        loadTimeSlotsForDate(firstAvailable.date)
      }
    }

    generateDays()
  }, [open, startDate, endDate, warehouse.working_days, warehouse.operating_hours])

  // Load time slots for selected date
  const loadTimeSlotsForDate = async (date: string) => {
    setLoadingTimeSlots(true)
    setSelectedTime("") // Clear previous selection while loading
    try {
      const result = await api.get<{
        date: string
        timeSlots: Array<{ time: string; available: boolean; reason?: string }>
      }>(`/api/v1/warehouses/${warehouse.id}/availability?date=${date}`, {
        showToast: false,
      })

      console.log(`[BookingTimeSlotModal] API response for ${date}:`, result)

      if (result.success && result.data) {
        const timeSlots = (result.data.timeSlots || []).map((slot) => ({
          time: slot.time,
          available: slot.available,
        }))

        console.log(`[BookingTimeSlotModal] Parsed ${timeSlots.length} time slots for ${date}`)
        console.log(`[BookingTimeSlotModal] Available slots: ${timeSlots.filter(s => s.available).length}`)
        console.log(`[BookingTimeSlotModal] All slots:`, timeSlots.slice(0, 5))

        // Update day availabilities with loaded time slots
        setDayAvailabilities((prev) =>
          prev.map((day) =>
            day.date === date
              ? { ...day, timeSlots }
              : day
          )
        )

        // Auto-select first available time slot
        const firstAvailable = timeSlots.find((slot) => slot.available)
        if (firstAvailable) {
          setSelectedTime(firstAvailable.time)
          console.log(`[BookingTimeSlotModal] Auto-selected first available slot: ${firstAvailable.time}`)
        } else if (timeSlots.length > 0) {
          // If there are slots but none are available, still allow selection (user can see why)
          console.warn(`[BookingTimeSlotModal] No available time slots for ${date}, but ${timeSlots.length} total slots exist`)
          setSelectedTime("")
        } else {
          setSelectedTime("")
          console.warn(`[BookingTimeSlotModal] No time slots returned for ${date}`)
        }
      } else {
        console.error(`[BookingTimeSlotModal] API call failed or no data:`, result)
        setSelectedTime("")
        // Update day availabilities with empty slots to show error state
        setDayAvailabilities((prev) =>
          prev.map((day) =>
            day.date === date
              ? { ...day, timeSlots: [] }
              : day
          )
        )
      }
    } catch (error) {
      console.error("[BookingTimeSlotModal] Error loading time slots:", error)
      setSelectedTime("")
      // Update day availabilities with empty slots to show error state
      setDayAvailabilities((prev) =>
        prev.map((day) =>
          day.date === date
            ? { ...day, timeSlots: [] }
            : day
        )
      )
    } finally {
      setLoadingTimeSlots(false)
    }
  }

  // When date is selected, load time slots
  useEffect(() => {
    if (selectedDate && open) {
      loadTimeSlotsForDate(selectedDate)
    }
  }, [selectedDate, open])


  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) {
      alert("Please select a date and time")
      return
    }

    setSubmitting(true)
    try {
      await onConfirm(selectedDate, selectedTime)
      onOpenChange(false)
    } catch (error) {
      console.error("Error confirming booking:", error)
      alert("Failed to create booking. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedDay = dayAvailabilities.find((d) => d.date === selectedDate)
  const selectedIndex = dayAvailabilities.findIndex((d) => d.date === selectedDate)
  const previousDay = selectedIndex > 0 ? dayAvailabilities[selectedIndex - 1] : null
  const nextDay = selectedIndex < dayAvailabilities.length - 1 ? dayAvailabilities[selectedIndex + 1] : null

  const handlePreviousDate = () => {
    if (previousDay && previousDay.isAvailable) {
      setSelectedDate(previousDay.date)
      setSelectedTime("")
    }
  }

  const handleNextDate = () => {
    if (nextDay && nextDay.isAvailable) {
      setSelectedDate(nextDay.date)
      setSelectedTime("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Your Booking</DialogTitle>
          <DialogDescription>
            Review your booking details and select a date and time for drop-off
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Left: Booking Summary */}
          <div className="space-y-4">
            <BookingSummary
              warehouseId={warehouse.id}
              type={type}
              quantity={quantity}
              startDate={startDate}
              endDate={endDate}
            />
          </div>

          {/* Right: Date and Time Selection */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Select Date and Time
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Time Slots - On Top */}
                {selectedDay && selectedDay.isAvailable ? (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Available Time Slots for {selectedDay ? formatDate(selectedDay.date) : "..."}
                    </label>
                    {loadingTimeSlots ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Loading available times...</span>
                      </div>
                    ) : selectedDay.timeSlots && selectedDay.timeSlots.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                        {selectedDay.timeSlots.map((slot) => (
                          <button
                            key={slot.time}
                            onClick={() => setSelectedTime(slot.time)}
                            disabled={!slot.available}
                            className={`p-3 rounded-lg border text-sm transition-colors ${
                              selectedTime === slot.time
                                ? "border-primary bg-primary text-primary-foreground font-medium"
                                : slot.available
                                ? "border-border hover:bg-muted hover:border-primary/50"
                                : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                            }`}
                          >
                            <Clock className="h-4 w-4 inline-block mr-1" />
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg bg-muted/30">
                        No available time slots for this date
                      </div>
                    )}
                  </div>
                ) : selectedDay && !selectedDay.isAvailable ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg bg-muted/30">
                    This date is not available (not a working day)
                  </div>
                ) : null}

                <Separator />

                {/* Date Navigation - Previous, Current, Next */}
                <div>
                  <label className="text-sm font-medium mb-3 block">Select Date</label>
                  <div className="flex items-center justify-center gap-4">
                    {/* Previous Date */}
                    {previousDay && (
                      <button
                        onClick={handlePreviousDate}
                        disabled={!previousDay.isAvailable}
                        className={`flex flex-col items-center p-4 rounded-lg border transition-colors min-w-[100px] ${
                          previousDay.isAvailable
                            ? "border-border hover:bg-muted cursor-pointer"
                            : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <ChevronLeft className="h-4 w-4 text-muted-foreground mb-1" />
                        <div className="text-xs text-muted-foreground">
                          {previousDay.dayName.substring(0, 3)}
                        </div>
                        <div className="text-sm font-medium">
                          {new Date(previousDay.date).getDate()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(previousDay.date).split(',')[0]}
                        </div>
                      </button>
                    )}

                    {/* Current Selected Date */}
                    {selectedDay && (
                      <button
                        className="flex flex-col items-center p-6 rounded-lg border-2 border-primary bg-primary/5 min-w-[140px] cursor-default"
                      >
                        <div className="text-sm font-semibold text-primary mb-1">
                          {selectedDay.dayName}
                        </div>
                        <div className="text-2xl font-bold text-primary mb-1">
                          {new Date(selectedDay.date).getDate()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(selectedDay.date)}
                        </div>
                        {!selectedDay.isAvailable && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            Not Available
                          </Badge>
                        )}
                      </button>
                    )}

                    {/* Next Date */}
                    {nextDay && (
                      <button
                        onClick={handleNextDate}
                        disabled={!nextDay.isAvailable}
                        className={`flex flex-col items-center p-4 rounded-lg border transition-colors min-w-[100px] ${
                          nextDay.isAvailable
                            ? "border-border hover:bg-muted cursor-pointer"
                            : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <ChevronRight className="h-4 w-4 text-muted-foreground mb-1" />
                        <div className="text-xs text-muted-foreground">
                          {nextDay.dayName.substring(0, 3)}
                        </div>
                        <div className="text-sm font-medium">
                          {new Date(nextDay.date).getDate()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(nextDay.date).split(',')[0]}
                        </div>
                      </button>
                    )}
                  </div>

                  {/* All Available Dates - Scrollable List */}
                  <div className="mt-4">
                    <label className="text-xs text-muted-foreground mb-2 block">Or select from all available dates:</label>
                    <div className="grid grid-cols-4 gap-2 max-h-[120px] overflow-y-auto">
                      {dayAvailabilities.map((day) => (
                        <button
                          key={day.date}
                          onClick={() => {
                            if (day.isAvailable) {
                              setSelectedDate(day.date)
                              setSelectedTime("")
                            }
                          }}
                          disabled={!day.isAvailable}
                          className={`p-2 rounded-lg border text-xs transition-colors ${
                            selectedDate === day.date
                              ? "border-primary bg-primary/5 font-medium"
                              : day.isAvailable
                              ? "border-border hover:bg-muted"
                              : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <div className="font-medium">{day.dayName.substring(0, 3)}</div>
                          <div className="text-muted-foreground">
                            {new Date(day.date).getDate()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Selected Date and Time Display */}
                {selectedDate && selectedTime && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Selected:</span>
                      <span className="font-medium">
                        {formatDate(selectedDate)} at {selectedTime}
                      </span>
                    </div>
                  </div>
                )}

                {/* Responsibility Notice - Always Visible */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {selectedTime 
                      ? `You are responsible for delivering your items to the warehouse at the selected time (${selectedTime}).`
                      : "You are responsible for delivering your items to the warehouse at the selected time."
                    }
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Confirm Button */}
            <div className="space-y-2">
              <Button
                className="w-full"
                size="lg"
                onClick={handleConfirm}
                disabled={!selectedDate || !selectedTime || submitting || loadingTimeSlots}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Booking...
                  </>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
              
              {(!selectedDate || !selectedTime) && !loadingTimeSlots && (
                <p className="text-xs text-center text-muted-foreground">
                  {!selectedDate 
                    ? "Please select a date to continue"
                    : !selectedTime 
                    ? "Please select a time slot to continue"
                    : ""
                  }
                </p>
              )}
              
              {selectedDate && selectedTime && (
                <p className="text-xs text-center text-muted-foreground">
                  Your booking will be created with status "pending". Warehouse staff will review and confirm.
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

