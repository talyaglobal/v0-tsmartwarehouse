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
 * If workingDays is empty, consider all days as working days
 */
function isWorkingDay(date: Date, workingDays: string[]): boolean {
  // If no working days specified, consider all days as working days
  if (!workingDays || workingDays.length === 0) {
    return true
  }
  
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
 * Now generates 30-minute intervals
 * Includes slots from openTime up to (but not including) closeTime
 */
function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const slots: string[] = []
  
  try {
    const [openHour, openMin] = openTime.split(":").map(Number)
    const [closeHour, closeMin] = closeTime.split(":").map(Number)

    // Validate times
    if (isNaN(openHour) || isNaN(openMin) || isNaN(closeHour) || isNaN(closeMin)) {
      console.error(`[generateTimeSlots] Invalid time format: openTime=${openTime}, closeTime=${closeTime}`)
      return []
    }

    // Check if times are valid
    if (openHour < 0 || openHour >= 24 || openMin < 0 || openMin >= 60 ||
        closeHour < 0 || closeHour >= 24 || closeMin < 0 || closeMin >= 60) {
      console.error(`[generateTimeSlots] Invalid time values: openTime=${openTime}, closeTime=${closeTime}`)
      return []
    }

    let currentHour = openHour
    let currentMin = openMin

    // Generate slots until we reach closeTime (exclusive)
    while (
      currentHour < closeHour ||
      (currentHour === closeHour && currentMin < closeMin)
    ) {
      const timeString = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`
      slots.push(timeString)

      // Increment by 30 minutes
      currentMin += 30
      if (currentMin >= 60) {
        currentHour += 1
        currentMin -= 60
      }
      if (currentHour >= 24) {
        break
      }
    }

    console.log(`[generateTimeSlots] Generated ${slots.length} slots from ${openTime} to ${closeTime}`)
    if (slots.length > 0) {
      console.log(`[generateTimeSlots] First slot: ${slots[0]}, Last slot: ${slots[slots.length - 1]}`)
    }
  } catch (error) {
    console.error(`[generateTimeSlots] Error generating slots:`, error)
    return []
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
 * Checks:
 * - Warehouse operating hours
 * - Existing bookings with scheduled drop-off times
 * - Warehouse staff tasks (receiving, putaway) at that time
 */
export async function getAvailableTimeSlots(
  warehouseId: string,
  date: string
): Promise<TimeSlot[]> {
  const supabase = createServerSupabaseClient()

  // Get operating hours
  const operatingHours = await getWarehouseOperatingHours(warehouseId)

  // Check if date is a working day
  // If working days are not specified, allow all days
  const targetDate = new Date(date)
  const workingDays = operatingHours.days || []
  
  // Only check working days if they are explicitly set
  if (workingDays.length > 0 && !isWorkingDay(targetDate, workingDays)) {
    console.log(`[availability] Date ${date} is not a working day. Working days: ${workingDays.join(', ')}`)
    return [] // No slots available on non-working days
  }

  // Get warehouse product acceptance hours if available
  const { data: warehouse, error: warehouseError } = await supabase
    .from("warehouses")
    .select("product_acceptance_start_time, product_acceptance_end_time")
    .eq("id", warehouseId)
    .single()

  if (warehouseError) {
    console.warn(`[availability] Error fetching warehouse ${warehouseId}:`, warehouseError)
  }

  // Use product acceptance hours if available, otherwise use operating hours, with fallback defaults
  // product_acceptance_start_time and product_acceptance_end_time are TIME type, so they come as strings like "08:00:00"
  let productStartTime = warehouse?.product_acceptance_start_time 
    ? String(warehouse.product_acceptance_start_time).slice(0, 5) // Convert "08:00:00" to "08:00"
    : operatingHours.open || "08:00"
  let productEndTime = warehouse?.product_acceptance_end_time
    ? String(warehouse.product_acceptance_end_time).slice(0, 5) // Convert "18:00:00" to "18:00"
    : operatingHours.close || "18:00"

  // Ensure we have valid time strings
  if (!productStartTime || !productEndTime || !productStartTime.match(/^\d{2}:\d{2}$/) || !productEndTime.match(/^\d{2}:\d{2}$/)) {
    console.warn(`[availability] Invalid time configuration for warehouse ${warehouseId}, using defaults. Start: ${productStartTime}, End: ${productEndTime}`)
    productStartTime = "08:00"
    productEndTime = "18:00"
  }

  // Generate all possible time slots for the day based on product acceptance hours
  const allSlots = generateTimeSlots(productStartTime, productEndTime)
  
  // If no slots generated, log warning and return empty array
  if (allSlots.length === 0) {
    console.warn(`[availability] No time slots generated for warehouse ${warehouseId} on ${date} with times ${productStartTime}-${productEndTime}`)
    console.warn(`[availability] Open time: ${productStartTime}, Close time: ${productEndTime}`)
    return []
  }
  
  console.log(`[availability] Generated ${allSlots.length} time slots for ${date} (${productStartTime} - ${productEndTime})`)

  // Get bookings with scheduled drop-off times on this date
  // We need to check all bookings and filter by their scheduled_dropoff_datetime or metadata
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, scheduled_dropoff_datetime, metadata, booking_status, start_date")
    .eq("warehouse_id", warehouseId)
    .in("booking_status", ["pending", "confirmed", "active", "awaiting_time_slot"])

  // Get bookings with requested drop-in time in metadata
  const bookingsWithTime: Array<{ time: string; bookingId: string }> = []
  if (bookings) {
    bookings.forEach((booking) => {
      // Check scheduled_dropoff_datetime
      if (booking.scheduled_dropoff_datetime) {
        const dropoffDate = new Date(booking.scheduled_dropoff_datetime)
        const dropoffDateStr = dropoffDate.toISOString().split("T")[0]
        if (dropoffDateStr === date) {
          const timeStr = dropoffDate.toTimeString().slice(0, 5) // HH:mm format
          bookingsWithTime.push({ time: timeStr, bookingId: booking.id })
        }
      }
      // Check metadata.requestedDropInTime
      if (booking.metadata && typeof booking.metadata === 'object') {
        const metadata = booking.metadata as Record<string, unknown>
        if (metadata.requestedDropInDate === date && typeof metadata.requestedDropInTime === 'string') {
          bookingsWithTime.push({ time: metadata.requestedDropInTime, bookingId: booking.id })
        }
      }
    })
  }

  // Get warehouse staff tasks (receiving, putaway) scheduled for this date/time
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, type, due_date, status")
    .eq("warehouse_id", warehouseId)
    .in("type", ["receiving", "putaway"])
    .in("status", ["pending", "assigned", "in-progress"])

  const tasksWithTime: Array<{ time: string; taskId: string }> = []
  if (tasks) {
    tasks.forEach((task) => {
      if (task.due_date) {
        const taskDate = new Date(task.due_date)
        const taskDateStr = taskDate.toISOString().split("T")[0]
        if (taskDateStr === date) {
          const timeStr = taskDate.toTimeString().slice(0, 5) // HH:mm format
          tasksWithTime.push({ time: timeStr, taskId: task.id })
        }
      }
    })
  }

  // Create sets of occupied times
  const occupiedTimes = new Set<string>()
  bookingsWithTime.forEach((b) => occupiedTimes.add(b.time))
  tasksWithTime.forEach((t) => occupiedTimes.add(t.time))

  // For each time slot, check if it's available
  const timeSlots: TimeSlot[] = allSlots.map((time) => {
    const isOccupied = occupiedTimes.has(time)
    
    return {
      time,
      available: !isOccupied,
      reason: isOccupied
        ? "Time slot is occupied by another booking or warehouse task"
        : undefined,
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

