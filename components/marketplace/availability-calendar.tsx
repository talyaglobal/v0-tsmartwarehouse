"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAvailabilityCalendar } from "@/lib/services/availability"

interface AvailabilityCalendarProps {
  warehouseId: string
  startDate?: Date
  endDate?: Date
  onDateSelect?: (date: Date) => void
  onDateRangeSelect?: (startDate: Date, endDate: Date) => void
  onStartDateChange?: (date: Date) => void
  className?: string
}

interface TimeSlot {
  time: string
  available: boolean
  reason?: string
}

export function AvailabilityCalendar({
  warehouseId,
  startDate: initialStartDate,
  endDate: initialEndDate,
  onDateSelect,
  onDateRangeSelect: _onDateRangeSelect,
  onStartDateChange,
  className,
}: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(
    initialStartDate || new Date()
  )
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(
    initialStartDate || null
  )
  const [_selectedEndDate, setSelectedEndDate] = useState<Date | null>(
    initialEndDate || null
  )
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [availability, setAvailability] = useState<Record<string, any>>({})
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false)

  // Load availability for the selected month
  const loadAvailability = useCallback(async () => {
    if (!warehouseId) return

    setLoading(true)
    try {
      const start = new Date(currentMonth)
      start.setDate(1)
      const end = new Date(currentMonth)
      end.setMonth(end.getMonth() + 1)
      end.setDate(0)

      const calendar = await getAvailabilityCalendar(
        warehouseId,
        start.toISOString().split("T")[0],
        end.toISOString().split("T")[0]
      )

      const availabilityMap: Record<string, any> = {}
      calendar.forEach((day) => {
        availabilityMap[day.date] = day
      })
      setAvailability(availabilityMap)
    } catch (error) {
      console.error("Error loading availability:", error)
    } finally {
      setLoading(false)
    }
  }, [warehouseId, currentMonth])

  // Load time slots for selected date
  const loadTimeSlots = useCallback(async (date: Date) => {
    if (!warehouseId) return

    setLoadingTimeSlots(true)
    try {
      const dateStr = date.toISOString().split("T")[0]
      const response = await fetch(
        `/api/v1/warehouses/${warehouseId}/availability?date=${dateStr}`
      )

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data?.timeSlots) {
          setTimeSlots(data.data.timeSlots)
        }
      }
    } catch (error) {
      console.error("Error loading time slots:", error)
      setTimeSlots([])
    } finally {
      setLoadingTimeSlots(false)
    }
  }, [warehouseId])

  // Load availability when month changes
  useEffect(() => {
    loadAvailability()
  }, [loadAvailability])

  // Load time slots when date is selected
  useEffect(() => {
    if (selectedDate) {
      loadTimeSlots(selectedDate)
    } else {
      setTimeSlots([])
    }
  }, [selectedDate, loadTimeSlots])

  const getDateAvailability = (date: Date): "available" | "limited" | "booked" | "unknown" | "past" => {
    const dateStr = date.toISOString().split("T")[0]
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateOnly = new Date(date)
    dateOnly.setHours(0, 0, 0, 0)

    // Check if date is in the past
    if (dateOnly < today) {
      return "past"
    }

    const day = availability[dateStr]

    if (!day) return "unknown"
    if (!day.isAvailable) return "booked"
    if (day.availableSqFt < 1000 || day.availablePallets < 10) return "limited"
    return "available"
  }

  const isDateDisabled = (date: Date): boolean => {
    const availabilityStatus = getDateAvailability(date)
    return availabilityStatus === "booked" || availabilityStatus === "unknown" || availabilityStatus === "past"
  }

  const isDateSelected = (date: Date): boolean => {
    if (!selectedStartDate) return false
    const dateStr = date.toISOString().split("T")[0]
    const startStr = selectedStartDate.toISOString().split("T")[0]
    return dateStr === startStr
  }

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) {
      return
    }

    // Always set as start date when clicking
    setSelectedStartDate(date)
    setSelectedEndDate(null)
    setSelectedDate(date)
    onDateSelect?.(date)
    onStartDateChange?.(date)
  }

  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: Date[] = []

    // Add days from previous month to fill first week
    const startDay = firstDay.getDay()
    for (let i = startDay - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i)
      days.push(prevDate)
    }

    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day))
    }

    // Add days from next month to fill last week
    const remainingDays = 42 - days.length // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      days.push(new Date(year, month + 1, day))
    }

    return days
  }

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }

  const formatMonthYear = (date: Date): string => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }

  const days = getDaysInMonth(currentMonth)
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Availability Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading availability...
          </div>
        ) : (
          <>
            {/* Month Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-semibold">{formatMonthYear(currentMonth)}</h3>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="space-y-2">
              {/* Week Day Headers */}
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((date, index) => {
                  const dateStr = date.toISOString().split("T")[0]
                  const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
                  const isToday =
                    dateStr === new Date().toISOString().split("T")[0]
                  const availabilityStatus = getDateAvailability(date)
                  const isSelected = isDateSelected(date)
                  const isDisabled = isDateDisabled(date)

                  return (
                    <button
                      key={`${dateStr}-${index}`}
                      onClick={() => handleDateClick(date)}
                      className={cn(
                        "aspect-square p-1 rounded-md text-sm transition-colors",
                        !isCurrentMonth && "text-muted-foreground/50",
                        isToday && "ring-2 ring-primary",
                        isSelected && "bg-primary text-primary-foreground",
                        availabilityStatus === "available" &&
                          !isSelected &&
                          !isDisabled &&
                          "hover:bg-green-50 dark:hover:bg-green-950",
                        availabilityStatus === "limited" &&
                          !isSelected &&
                          !isDisabled &&
                          "hover:bg-yellow-50 dark:hover:bg-yellow-950",
                        isDisabled && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={isDisabled}
                    >
                      <div className="flex flex-col items-center justify-center h-full">
                        <span>{date.getDate()}</span>
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full mt-0.5",
                            availabilityStatus === "available" && "bg-green-500",
                            availabilityStatus === "limited" && "bg-yellow-500",
                            availabilityStatus === "booked" && "bg-red-500",
                            availabilityStatus === "past" && "bg-gray-400",
                            availabilityStatus === "unknown" && "bg-gray-300"
                          )}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected Date Display */}
            {selectedStartDate && (
              <div className="p-3 border rounded-md bg-muted/50">
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Selected Start Date:</span>
                    <span>
                      {selectedStartDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Time Slots for Selected Date */}
            {selectedDate && (
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Available Time Slots for{" "}
                    {selectedDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {loadingTimeSlots ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Loading time slots...
                  </div>
                ) : timeSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        className={cn(
                          "px-3 py-2 rounded-md text-sm border transition-colors",
                          slot.available
                            ? "border-primary/20 hover:bg-primary/10 hover:border-primary cursor-pointer"
                            : "opacity-50 cursor-not-allowed bg-muted"
                        )}
                        title={slot.reason}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No time slots available
                  </div>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 pt-4 border-t text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>Limited</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Booked</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
