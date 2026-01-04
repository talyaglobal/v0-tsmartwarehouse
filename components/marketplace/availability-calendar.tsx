"use client"

import { useState, useEffect, useCallback } from "react"
// Using a simple grid calendar - can be replaced with proper calendar component when available
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAvailabilityCalendar } from "@/lib/services/availability"

interface AvailabilityCalendarProps {
  warehouseId: string
  startDate?: Date
  endDate?: Date
  onDateSelect?: (date: Date) => void
  className?: string
}

export function AvailabilityCalendar({
  warehouseId,
  startDate,
  endDate: _endDate,
  onDateSelect: _onDateSelect,
  className,
}: AvailabilityCalendarProps) {
  const [selectedMonth] = useState<Date>(startDate || new Date())
  const [availability, setAvailability] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)

  // Load availability for the selected month
  const loadAvailability = useCallback(async () => {
    if (!warehouseId) return

    setLoading(true)
    try {
      const start = new Date(selectedMonth)
      start.setDate(1)
      const end = new Date(selectedMonth)
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
  }, [warehouseId, selectedMonth])

  // Load availability when month changes
  useEffect(() => {
    loadAvailability()
  }, [loadAvailability])

  const getDateAvailability = (date: Date): "available" | "limited" | "booked" | "unknown" => {
    const dateStr = date.toISOString().split("T")[0]
    const day = availability[dateStr]

    if (!day) return "unknown"
    if (!day.isAvailable) return "booked"
    if (day.availableSqFt < 1000 || day.availablePallets < 10) return "limited"
    return "available"
  }


  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Availability Calendar</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading availability...</div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Availability calendar - Calendar component integration pending
            </div>
            {/* Simple date display for now */}
            {startDate && (
              <div className="p-4 border rounded-md">
                <p className="text-sm font-medium">Selected Start Date</p>
                <p className="text-lg">{startDate.toLocaleDateString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Status: {getDateAvailability(startDate)}
                </p>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 pt-4 border-t text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300" />
                <span>Limited</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
                <span>Booked</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
