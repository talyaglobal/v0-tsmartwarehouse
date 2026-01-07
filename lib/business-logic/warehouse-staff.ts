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
  warehouseCity?: string | null
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
        name,
        city
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
    warehouseCity: row.warehouses?.city || null,
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
    status?: BookingStatus | BookingStatus[] // Support single status or array of statuses
    warehouseId?: string
    startDate?: string
    endDate?: string
    customerSearch?: string // Search by customer name or email
    sortBy?: 'date' | 'amount' | 'status' | 'warehouse'
    sortOrder?: 'asc' | 'desc'
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

  // Handle status filter - can be single status or array
  let statusFilter: BookingStatus | undefined = undefined
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      // If array, we'll filter after fetching (since getBookings only supports single status)
      statusFilter = undefined // Fetch all, then filter
    } else {
      statusFilter = filters.status
    }
  }

  // Get bookings for assigned warehouses
  const bookings = await getBookings({
    warehouseId: filters?.warehouseId,
    warehouseIds: filters?.warehouseId ? undefined : warehouseIds, // Use warehouseIds if no specific warehouse filter
    warehouseCompanyId: undefined, // We're filtering by specific warehouse IDs
    status: statusFilter,
    useCache: false, // Always get fresh data for staff
  })

  // If specific warehouse filter was provided, bookings are already filtered
  // Otherwise, filter by warehouse IDs (as a safety check)
  let filteredBookings = filters?.warehouseId 
    ? bookings 
    : bookings.filter((b) => warehouseIds.includes(b.warehouseId))

  // Apply multiple status filter if provided as array
  if (filters?.status && Array.isArray(filters.status)) {
    filteredBookings = filteredBookings.filter((b) => 
      filters.status!.includes(b.status as BookingStatus)
    )
  }

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

  // Apply customer search filter
  if (filters?.customerSearch) {
    const searchTerm = filters.customerSearch.toLowerCase()
    filteredBookings = filteredBookings.filter(
      (b) => 
        b.customerName.toLowerCase().includes(searchTerm) ||
        b.customerEmail.toLowerCase().includes(searchTerm)
    )
  }

  // Apply sorting
  if (filters?.sortBy) {
    const sortOrder = filters.sortOrder || 'desc'
    filteredBookings.sort((a, b) => {
      let comparison = 0
      
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          break
        case 'amount':
          comparison = (a.totalAmount || 0) - (b.totalAmount || 0)
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'warehouse':
          comparison = a.warehouseId.localeCompare(b.warehouseId)
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
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
  console.log(`[setBookingAwaitingTimeSlot] Starting for bookingId: ${bookingId}, staffId: ${staffId}`)
  
  // Verify staff has access to the booking's warehouse
  const booking = await getBookingById(bookingId, false) // Disable cache to get fresh data
  console.log(`[setBookingAwaitingTimeSlot] Booking fetched:`, booking ? `Found (status: ${booking.status})` : 'Not found')
  
  if (!booking) {
    console.error(`[setBookingAwaitingTimeSlot] Booking not found for ID: ${bookingId}`)
    throw new Error(`Booking not found: ${bookingId}`)
  }

  const hasAccess = await hasWarehouseAccess(staffId, booking.warehouseId)
  console.log(`[setBookingAwaitingTimeSlot] Staff access check:`, hasAccess ? 'Has access' : 'No access')
  
  if (!hasAccess) {
    throw new Error("Staff member does not have access to this warehouse")
  }

  // Verify booking is in pre_order status
  if (booking.status !== "pre_order") {
    console.error(`[setBookingAwaitingTimeSlot] Invalid status: ${booking.status}, expected: pre_order`)
    throw new Error(`Booking must be in pre_order status to set awaiting_time_slot. Current status: ${booking.status}`)
  }

  // Update booking status
  console.log(`[setBookingAwaitingTimeSlot] Updating booking status to awaiting_time_slot`)
  const updatedBooking = await updateBooking(bookingId, {
    status: "awaiting_time_slot",
  })

  console.log(`[setBookingAwaitingTimeSlot] Booking updated successfully`)
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
  console.log(`[proposeDateChange] Starting for bookingId: ${bookingId}, staffId: ${staffId}, newDate: ${newDate}, newTime: ${newTime}`)
  
  // Verify staff has access to the booking's warehouse
  const booking = await getBookingById(bookingId, false) // Disable cache to get fresh data
  console.log(`[proposeDateChange] Booking fetched:`, booking ? `Found (status: ${booking.status})` : 'Not found')
  
  if (!booking) {
    console.error(`[proposeDateChange] Booking not found for ID: ${bookingId}`)
    throw new Error(`Booking not found: ${bookingId}`)
  }

  const hasAccess = await hasWarehouseAccess(staffId, booking.warehouseId)
  console.log(`[proposeDateChange] Staff access check:`, hasAccess ? 'Has access' : 'No access')
  
  if (!hasAccess) {
    throw new Error("Staff member does not have access to this warehouse")
  }

  // Verify booking is in a status that allows date change proposals
  // Allow: pre_order, awaiting_time_slot, and pending (warehouse staff can propose changes for pending bookings)
  const allowedStatuses: BookingStatus[] = ["pre_order", "awaiting_time_slot", "pending"]
  if (!allowedStatuses.includes(booking.status)) {
    console.error(`[proposeDateChange] Invalid status: ${booking.status}, expected: pre_order, awaiting_time_slot, or pending`)
    throw new Error(`Booking must be in 'pre_order', 'awaiting_time_slot', or 'pending' status to propose date change. Current status: ${booking.status}`)
  }

  // Combine date and time into a single datetime
  const proposedDateTime = `${newDate}T${newTime}:00`
  console.log(`[proposeDateChange] Proposed datetime: ${proposedDateTime}`)

  // Update booking with proposed date/time
  console.log(`[proposeDateChange] Updating booking with proposed date/time`)
  const updatedBooking = await updateBooking(bookingId, {
    proposedStartDate: proposedDateTime,
    proposedStartTime: newTime,
    dateChangeRequestedAt: new Date().toISOString(),
    dateChangeRequestedBy: staffId,
    status: "awaiting_time_slot", // Set status to awaiting customer confirmation
  })

  console.log(`[proposeDateChange] Booking updated successfully`)
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
  _warehouseId: string,
  _date: string
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

  // For now, return all default slots
  // Full implementation should check actual time conflicts
  // TODO: Use getBookings to filter out conflicting bookings when implementing full availability check
  return defaultSlots
}

