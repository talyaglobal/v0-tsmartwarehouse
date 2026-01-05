"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  className?: string
  startDateLabel?: string
  endDateLabel?: string
  minDate?: string // Minimum selectable date (YYYY-MM-DD)
  disabled?: boolean
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
  startDateLabel = "Start Date",
  endDateLabel = "End Date",
  minDate,
  disabled = false,
}: DateRangePickerProps) {
  const today = new Date().toISOString().split("T")[0]

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value
    onStartDateChange(newStartDate)

    // If end date is before new start date, update end date
    if (endDate && newStartDate && endDate < newStartDate) {
      onEndDateChange(newStartDate)
    }
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = e.target.value

    // Validate that end date is not before start date
    if (startDate && newEndDate && newEndDate < startDate) {
      // Don't update if invalid
      return
    }

    onEndDateChange(newEndDate)
  }

  // Determine minimum date for end date input
  const endDateMin = startDate || minDate || today

  return (
    <div className={cn("flex flex-col sm:flex-row gap-2", className)}>
      <div className="flex-1">
        <label htmlFor="start-date" className="sr-only">
          {startDateLabel}
        </label>
        <Input
          id="start-date"
          type="date"
          value={startDate}
          onChange={handleStartDateChange}
          min={minDate || today}
          disabled={disabled}
          className="w-full"
          aria-label={startDateLabel}
        />
      </div>
      <div className="flex-1">
        <label htmlFor="end-date" className="sr-only">
          {endDateLabel}
        </label>
        <Input
          id="end-date"
          type="date"
          value={endDate}
          onChange={handleEndDateChange}
          min={endDateMin}
          disabled={disabled}
          className="w-full"
          aria-label={endDateLabel}
        />
      </div>
    </div>
  )
}

