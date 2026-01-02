import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getBookings } from "@/lib/db/bookings"
import type { Booking } from "@/types"

/**
 * Business Logic: Warehouse Availability
 * 
 * Handles:
 * - Checking warehouse operating hours
 * - Checking existing bookings on specific dates/times
 * - Checking bookings that need to exit on specific dates
 * - Calculating available time slots
 */

export interface TimeSlot {
  time: string // HH:mm format
  available: boolean
  reason?: string // Why it's not available
}

export interface AvailabilityCheck {
  available: boolean
  availableSlots: TimeSlot[]
  conflictingBookings: Booking[]
  reason?: string
}

export interface WarehouseOperatingHours {
  open?: string // HH:mm format
  close?: string // HH:mm format
  days?: string[] // Day names like "Monday", "Tuesday", etc.
}

/**
 * Get warehouse operating hours
 */
async function getWarehouseOperatingHours(
  warehouseId: string
): Promise<WarehouseOperatingHours> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("warehouses")
    .select("operating_hours, working_days")
    .eq("id", warehouseId)
    .single()

  if (error || !data) {
    // Return default hours if not found
    return {
      open: "06:00",
      close: "22:00",
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    }
  }

  const operatingHours = (data.operating_hours as WarehouseOperatingHours) || {}
  const workingDays = (data.working_days as string[]) || []

  return {
    open: operatingHours.open || "06:00",
    close: operatingHours.close || "22:00",
    days: workingDays.length > 0 ? workingDays : operatingHours.days || [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
  }
}

/**
 * Check if a date is a working day
 */
function isWorkingDay(date: Date, workingDays: string[]): boolean {
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]
  const dayName = dayNames[date.getDay()]
  return workingDays.includes(dayName)
}

/**
 * Generate time slots for a day based on operating hours
 */
function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const slots: string[] = []
  const [openHour, openMin] = openTime.split(":").map(Number)
  const [closeHour, closeMin] = closeTime.split(":").map(Number)

  let currentHour = openHour
  let currentMin = openMin

  while (
    currentHour < closeHour ||
    (currentHour === closeHour && currentMin < closeMin)
  ) {
    const timeString = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`
    slots.push(timeString)

    // Increment by 1 hour
    currentHour += 1
    if (currentHour >= 24) {
      break
    }
  }

  return slots
}

/**
 * Get bookings that conflict with a specific date/time
 */
async function getConflictingBookings(
  warehouseId: string,
  date: string,
  time?: string
): Promise<Booking[]> {
  const bookings = await getBookings({
    warehouseId,
    useCache: false,
  })

  const targetDate = new Date(date)
  const targetDateStr = targetDate.toISOString().split("T")[0] // YYYY-MM-DD

  // Filter bookings on the same date
  const sameDateBookings = bookings.filter((b) => {
    const bookingDate = new Date(b.startDate)
    const bookingDateStr = bookingDate.toISOString().split("T")[0]
    return bookingDateStr === targetDateStr
  })

  // Filter by status - only confirmed/active bookings matter
  const activeBookings = sameDateBookings.filter(
    (b) => b.status === "confirmed" || b.status === "active"
  )

  // If time is provided, check for time conflicts
  if (time) {
    // For now, if there are any bookings on that date, consider it a conflict
    // Full implementation should check actual time slots
    // This is simplified - in production, you'd check if the time slots overlap
    return activeBookings
  }

  return activeBookings
}

/**
 * Get bookings that need to exit on a specific date
 * (bookings with end_date on that date)
 */
async function getExitingBookings(
  warehouseId: string,
  date: string
): Promise<Booking[]> {
  const bookings = await getBookings({
    warehouseId,
    useCache: false,
  })

  const targetDate = new Date(date)
  const targetDateStr = targetDate.toISOString().split("T")[0] // YYYY-MM-DD

  return bookings.filter((b) => {
    if (!b.endDate) return false
    const endDate = new Date(b.endDate)
    const endDateStr = endDate.toISOString().split("T")[0]
    return (
      endDateStr === targetDateStr &&
      (b.status === "confirmed" || b.status === "active")
    )
  })
}

/**
 * Check warehouse availability for a specific date and time
 */
export async function checkWarehouseAvailability(
  warehouseId: string,
  date: string,
  time: string
): Promise<AvailabilityCheck> {
  // Get operating hours
  const operatingHours = await getWarehouseOperatingHours(warehouseId)

  // Check if date is a working day
  const targetDate = new Date(date)
  if (!isWorkingDay(targetDate, operatingHours.days || [])) {
    return {
      available: false,
      availableSlots: [],
      conflictingBookings: [],
      reason: "Date is not a working day",
    }
  }

  // Check if time is within operating hours
  const [timeHour, timeMin] = time.split(":").map(Number)
  const [openHour, openMin] = operatingHours.open!.split(":").map(Number)
  const [closeHour, closeMin] = operatingHours.close!.split(":").map(Number)

  const timeMinutes = timeHour * 60 + timeMin
  const openMinutes = openHour * 60 + openMin
  const closeMinutes = closeHour * 60 + closeMin

  if (timeMinutes < openMinutes || timeMinutes >= closeMinutes) {
    return {
      available: false,
      availableSlots: [],
      conflictingBookings: [],
      reason: "Time is outside operating hours",
    }
  }

  // Check for conflicting bookings
  const conflictingBookings = await getConflictingBookings(warehouseId, date, time)

  // Check for exiting bookings (these might affect availability)
  const exitingBookings = await getExitingBookings(warehouseId, date)

  // If there are conflicting bookings, time slot is not available
  if (conflictingBookings.length > 0) {
    return {
      available: false,
      availableSlots: [],
      conflictingBookings,
      reason: `There are ${conflictingBookings.length} conflicting booking(s) on this date/time`,
    }
  }

  // If there are too many exiting bookings, might affect availability
  // For now, we'll allow it, but in production you might want to limit concurrent operations
  if (exitingBookings.length > 5) {
    return {
      available: false,
      availableSlots: [],
      conflictingBookings: [],
      reason: "Too many bookings exiting on this date - warehouse may be busy",
    }
  }

  return {
    available: true,
    availableSlots: [{ time, available: true }],
    conflictingBookings: [],
  }
}

/**
 * Get available time slots for a specific date
 */
export async function getAvailableTimeSlots(
  warehouseId: string,
  date: string
): Promise<TimeSlot[]> {
  // Get operating hours
  const operatingHours = await getWarehouseOperatingHours(warehouseId)

  // Check if date is a working day
  const targetDate = new Date(date)
  if (!isWorkingDay(targetDate, operatingHours.days || [])) {
    return [] // No slots available on non-working days
  }

  // Generate all possible time slots for the day
  const allSlots = generateTimeSlots(
    operatingHours.open!,
    operatingHours.close!
  )

  // Get conflicting bookings
  const conflictingBookings = await getConflictingBookings(warehouseId, date)

  // For each time slot, check if it's available
  const timeSlots: TimeSlot[] = allSlots.map((time) => {
    // Simplified: if there are any bookings on this date, mark all slots as potentially unavailable
    // Full implementation should check actual time slot conflicts
    // For now, we'll mark slots as available if there are fewer than 3 bookings
    const isAvailable = conflictingBookings.length < 3

    return {
      time,
      available: isAvailable,
      reason: isAvailable
        ? undefined
        : `There are ${conflictingBookings.length} booking(s) on this date`,
    }
  })

  return timeSlots
}

/**
 * Get conflicting bookings for a specific date
 */
export async function getConflictingBookingsForDate(
  warehouseId: string,
  date: string
): Promise<Booking[]> {
  return getConflictingBookings(warehouseId, date)
}

