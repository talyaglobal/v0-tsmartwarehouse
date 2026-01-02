import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getBookings, getBookingById, updateBooking } from "@/lib/db/bookings"
import type { Booking, BookingStatus } from "@/types"

/**
 * Business Logic: Warehouse Staff Operations
 * 
 * Handles:
 * - Getting warehouses assigned to staff
 * - Getting bookings for staff's warehouses
 * - Setting booking status to awaiting_time_slot
 * - Proposing date/time changes
 */

export interface WarehouseStaffAssignment {
  warehouseId: string
  warehouseName: string
  role: "manager" | "staff"
  assignedAt: string
}

/**
 * Get all warehouses assigned to a warehouse staff member
 */
export async function getWarehouseStaffWarehouses(
  staffId: string
): Promise<WarehouseStaffAssignment[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from("warehouse_staff")
    .select(`
      warehouse_id,
      role,
      created_at,
      warehouses!inner (
        id,
        name
      )
    `)
    .eq("user_id", staffId)
    .eq("status", true) // Only active assignments

  if (error) {
    throw new Error(`Failed to fetch warehouse assignments: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return []
  }

  return data.map((row: any) => ({
    warehouseId: row.warehouse_id,
    warehouseName: row.warehouses?.name || "Unknown Warehouse",
    role: row.role as "manager" | "staff",
    assignedAt: row.created_at,
  }))
}

/**
 * Get bookings for warehouses assigned to a warehouse staff member
 */
export async function getBookingsForWarehouseStaff(
  staffId: string,
  filters?: {
    status?: BookingStatus
    warehouseId?: string
    startDate?: string
    endDate?: string
  }
): Promise<Booking[]> {
  // First, get all warehouses assigned to this staff
  const warehouses = await getWarehouseStaffWarehouses(staffId)

  if (warehouses.length === 0) {
    return []
  }

  const warehouseIds = warehouses.map((w) => w.warehouseId)

  // If specific warehouse filter is provided, ensure staff has access
  if (filters?.warehouseId) {
    if (!warehouseIds.includes(filters.warehouseId)) {
      throw new Error("Staff member does not have access to this warehouse")
    }
  }

  // Get bookings for assigned warehouses
  const bookings = await getBookings({
    warehouseId: filters?.warehouseId,
    warehouseIds: filters?.warehouseId ? undefined : warehouseIds, // Use warehouseIds if no specific warehouse filter
    warehouseCompanyId: undefined, // We're filtering by specific warehouse IDs
    status: filters?.status,
    useCache: false, // Always get fresh data for staff
  })

  // If specific warehouse filter was provided, bookings are already filtered
  // Otherwise, filter by warehouse IDs (as a safety check)
  let filteredBookings = filters?.warehouseId 
    ? bookings 
    : bookings.filter((b) => warehouseIds.includes(b.warehouseId))

  // Apply date filters if provided
  if (filters?.startDate) {
    filteredBookings = filteredBookings.filter(
      (b) => b.startDate >= filters.startDate!
    )
  }

  if (filters?.endDate) {
    filteredBookings = filteredBookings.filter(
      (b) => b.startDate <= filters.endDate!
    )
  }

  return filteredBookings
}

/**
 * Check if a warehouse staff member has access to a specific warehouse
 */
export async function hasWarehouseAccess(
  staffId: string,
  warehouseId: string
): Promise<boolean> {
  const warehouses = await getWarehouseStaffWarehouses(staffId)
  return warehouses.some((w) => w.warehouseId === warehouseId)
}

/**
 * Set booking status to awaiting_time_slot
 * This is called when warehouse staff confirms that the requested date/time is available
 */
export async function setBookingAwaitingTimeSlot(
  bookingId: string,
  staffId: string
): Promise<Booking> {
  // Verify staff has access to the booking's warehouse
  const booking = await getBookingById(bookingId)
  if (!booking) {
    throw new Error("Booking not found")
  }

  const hasAccess = await hasWarehouseAccess(staffId, booking.warehouseId)
  if (!hasAccess) {
    throw new Error("Staff member does not have access to this warehouse")
  }

  // Verify booking is in pre_order status
  if (booking.status !== "pre_order") {
    throw new Error("Booking must be in pre_order status to set awaiting_time_slot")
  }

  // Update booking status
  const updatedBooking = await updateBooking(bookingId, {
    status: "awaiting_time_slot",
  })

  return updatedBooking
}

/**
 * Propose a new date/time to customer
 * This is called when warehouse staff determines the requested date/time is not available
 */
export async function proposeDateChange(
  bookingId: string,
  newDate: string,
  newTime: string,
  staffId: string
): Promise<Booking> {
  // Verify staff has access to the booking's warehouse
  const booking = await getBookingById(bookingId)
  if (!booking) {
    throw new Error("Booking not found")
  }

  const hasAccess = await hasWarehouseAccess(staffId, booking.warehouseId)
  if (!hasAccess) {
    throw new Error("Staff member does not have access to this warehouse")
  }

  // Combine date and time into a single datetime
  const proposedDateTime = `${newDate}T${newTime}:00`

  // Update booking with proposed date/time
  const updatedBooking = await updateBooking(bookingId, {
    proposedStartDate: proposedDateTime,
    proposedStartTime: newTime,
    dateChangeRequestedAt: new Date().toISOString(),
    dateChangeRequestedBy: staffId,
    status: "awaiting_time_slot", // Set status to awaiting customer confirmation
  })

  return updatedBooking
}

/**
 * Check if a specific date/time is available for a warehouse
 * This is a simple check - full availability logic is in availability.ts
 */
export async function checkDateAvailability(
  warehouseId: string,
  date: string,
  time?: string
): Promise<boolean> {
  // This is a placeholder - full implementation should use availability.ts
  // For now, just check if there are any bookings on that date
  const bookings = await getBookings({
    warehouseId,
    useCache: false,
  })

  const targetDate = new Date(date)
  const conflictingBookings = bookings.filter((b) => {
    const bookingDate = new Date(b.startDate)
    return (
      bookingDate.toDateString() === targetDate.toDateString() &&
      (b.status === "confirmed" || b.status === "active")
    )
  })

  // If time is provided, check for time conflicts
  if (time) {
    // This is simplified - full implementation should check actual time slots
    // For now, if there are any bookings on that date, consider it unavailable
    return conflictingBookings.length === 0
  }

  return conflictingBookings.length === 0
}

/**
 * Get available time slots for a specific date
 * This is a simplified version - full implementation should use availability.ts
 */
export async function getAvailableTimeSlots(
  warehouseId: string,
  date: string
): Promise<string[]> {
  // This is a placeholder - full implementation should use availability.ts
  // For now, return default time slots
  const defaultSlots = [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
  ]

  // Check which slots are available
  const bookings = await getBookings({
    warehouseId,
    useCache: false,
  })

  const targetDate = new Date(date)
  const conflictingBookings = bookings.filter((b) => {
    const bookingDate = new Date(b.startDate)
    return (
      bookingDate.toDateString() === targetDate.toDateString() &&
      (b.status === "confirmed" || b.status === "active")
    )
  })

  // For now, return all default slots
  // Full implementation should check actual time conflicts
  return defaultSlots
}

