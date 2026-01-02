import { createServerSupabaseClient } from "@/lib/supabase/server"
import { checkPalletCapacity, checkAreaRentalCapacity, reserveCapacity } from "./capacity"
import { calculatePalletPricing, calculateAreaRentalPricing } from "./pricing"
import { getBookings, getBookingById, createBooking, updateBooking } from "@/lib/db/bookings"
import { getNotificationService } from "@/lib/notifications/service"
import type { Booking, BookingType, MembershipTier } from "@/types"

/**
 * Business Logic: Booking Creation with Availability Checking
 * 
 * Handles:
 * - Capacity validation
 * - Pricing calculation with discounts
 * - Membership tier consideration
 * - Automatic invoice generation
 */

export interface CreateBookingInput {
  customerId: string
  customerName: string
  customerEmail: string
  warehouseId: string
  type: BookingType
  palletCount?: number
  areaSqFt?: number
  floorNumber?: 3
  hallId?: string
  startDate: string
  endDate?: string
  months?: number
  notes?: string
  membershipTier?: MembershipTier
  isPreOrder?: boolean // If true, creates booking with 'pre_order' status
}

export interface CreateBookingResult {
  booking: Booking
  capacityChecked: boolean
  pricingCalculated: boolean
  invoiceCreated: boolean
  message: string
}

/**
 * Create a booking with full availability checking and pricing
 */
export async function createBookingWithAvailability(
  input: CreateBookingInput
): Promise<CreateBookingResult> {
  // Step 1: Check capacity
  let capacityCheck
  if (input.type === "pallet") {
    if (!input.palletCount) {
      throw new Error("Pallet count is required for pallet bookings")
    }
    capacityCheck = await checkPalletCapacity(
      input.warehouseId,
      input.palletCount
    )
    if (!capacityCheck.available) {
      throw new Error(capacityCheck.message)
    }
  } else if (input.type === "area-rental") {
    if (!input.areaSqFt) {
      throw new Error("Area square footage is required for area rental bookings")
    }
    capacityCheck = await checkAreaRentalCapacity(
      input.warehouseId,
      input.areaSqFt,
      input.floorNumber
    )
    if (!capacityCheck.available) {
      throw new Error(capacityCheck.message)
    }
  } else {
    throw new Error("Invalid booking type")
  }

  // Step 2: Get customer's existing pallet count for membership calculation
  const existingBookings = await getBookings({
    customerId: input.customerId,
    status: "active",
  })
  const existingPalletCount = existingBookings
    .filter((b) => b.type === "pallet")
    .reduce((sum, b) => sum + (b.palletCount || 0), 0)

  // Step 3: Calculate pricing with discounts (using warehouse-specific pricing)
  let pricingResult
  if (input.type === "pallet") {
    pricingResult = await calculatePalletPricing({
      type: "pallet",
      warehouseId: input.warehouseId,
      palletCount: input.palletCount,
      months: input.months || 1,
      membershipTier: input.membershipTier,
      existingPalletCount,
    })
  } else {
    pricingResult = await calculateAreaRentalPricing({
      type: "area-rental",
      warehouseId: input.warehouseId,
      areaSqFt: input.areaSqFt,
      membershipTier: input.membershipTier,
    })
  }

  // Step 4: Create booking
  // For pallet bookings, default to pre-order flow unless explicitly set
  const bookingStatus = input.isPreOrder !== undefined 
    ? (input.isPreOrder ? "pre_order" : "pending")
    : (input.type === "pallet" ? "pre_order" : "pending")

  const booking = await createBooking({
    customerId: input.customerId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    warehouseId: input.warehouseId,
    type: input.type,
    status: bookingStatus,
    palletCount: input.palletCount,
    areaSqFt: input.areaSqFt,
    floorNumber: input.floorNumber,
    hallId: input.hallId,
    startDate: input.startDate,
    endDate: input.endDate,
    totalAmount: pricingResult.finalAmount,
    notes: input.notes,
  })

  // Step 5: Reserve capacity (only when booking is confirmed, not pending)
  // Capacity will be reserved when admin confirms the booking
  // For now, we just check availability

  return {
    booking,
    capacityChecked: true,
    pricingCalculated: true,
    invoiceCreated: false, // Invoice created separately when booking is confirmed
    message: "Booking created successfully. Awaiting admin confirmation.",
  }
}

/**
 * Confirm a booking and reserve capacity
 */
export async function confirmBooking(bookingId: string): Promise<Booking> {
  const supabase = createServerSupabaseClient()

  // Get booking
  const { data: bookingData, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("status", true) // Soft delete filter
    .single()

  if (bookingError || !bookingData) {
    throw new Error(`Booking not found: ${bookingError?.message}`)
  }

  // Check booking_status (business status), not status (soft delete)
  if (bookingData.booking_status !== "pending") {
    throw new Error(`Booking is not in pending status. Current status: ${bookingData.booking_status}`)
  }

  // Reserve capacity
  if (bookingData.type === "pallet" && bookingData.pallet_count) {
    await reserveCapacity(
      bookingData.warehouse_id,
      "pallet",
      bookingData.pallet_count
    )
  } else if (
    bookingData.type === "area-rental" &&
    bookingData.area_sq_ft &&
    bookingData.hall_id
  ) {
    await reserveCapacity(
      bookingData.warehouse_id,
      "area-rental",
      bookingData.area_sq_ft,
      bookingData.hall_id
    )
  }

  // Update booking status
  const updatedBooking = await updateBooking(bookingId, {
    status: "confirmed",
  })

  // Send notification to customer
  try {
    const notificationService = getNotificationService()
    await notificationService.sendNotification({
      userId: bookingData.customer_id,
      type: "booking",
      channels: ["email", "push"],
      title: "Booking Confirmed",
      message: `Your booking #${bookingId.slice(0, 8)} has been confirmed. ${bookingData.type === "pallet" ? `${bookingData.pallet_count} pallets` : `${bookingData.area_sq_ft} sq ft`} ready for storage.`,
      template: "booking-confirmed",
      templateData: {
        bookingId: bookingId.slice(0, 8),
        bookingType: bookingData.type,
        quantity: bookingData.type === "pallet" ? bookingData.pallet_count : bookingData.area_sq_ft,
        status: "Confirmed",
        customerName: bookingData.customer_name,
      },
    })
  } catch (error) {
    // Log error but don't fail the booking confirmation
    console.error("Failed to send booking confirmation notification:", error)
  }

  return updatedBooking
}

/**
 * Activate a booking (when it actually starts)
 */
export async function activateBooking(bookingId: string): Promise<Booking> {
  const booking = await updateBooking(bookingId, {
    status: "active",
  })
  return booking
}

/**
 * Complete a booking and release capacity
 */
export async function completeBooking(bookingId: string): Promise<Booking> {
  const supabase = createServerSupabaseClient()

  // Get booking
  const { data: bookingData, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single()

  if (bookingError || !bookingData) {
    throw new Error(`Booking not found: ${bookingError?.message}`)
  }

  // Release capacity
  if (bookingData.type === "pallet" && bookingData.pallet_count) {
    // Note: We'd need to track which zone was used
    // For now, this is a simplified version
    // In production, you'd store zone_id with the booking
  } else if (
    bookingData.type === "area-rental" &&
    bookingData.area_sq_ft &&
    bookingData.hall_id
  ) {
    const { releaseCapacity } = await import("./capacity")
    await releaseCapacity(
      bookingData.warehouse_id,
      "area-rental",
      bookingData.area_sq_ft,
      bookingData.hall_id
    )
  }

  // Update booking status
  const updatedBooking = await updateBooking(bookingId, {
    status: "completed",
  })

  return updatedBooking
}

/**
 * Cancel a booking and release capacity
 */
export async function cancelBooking(bookingId: string): Promise<Booking> {
  const supabase = createServerSupabaseClient()

  // Get booking
  const { data: bookingData, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single()

  if (bookingError || !bookingData) {
    throw new Error(`Booking not found: ${bookingError?.message}`)
  }

  // Only release capacity if booking was confirmed or active
  if (
    (bookingData.status === "confirmed" || bookingData.status === "active") &&
    bookingData.type === "area-rental" &&
    bookingData.area_sq_ft &&
    bookingData.hall_id
  ) {
    const { releaseCapacity } = await import("./capacity")
    await releaseCapacity(
      bookingData.warehouse_id,
      "area-rental",
      bookingData.area_sq_ft,
      bookingData.hall_id
    )
  }

  // Update booking status
  const updatedBooking = await updateBooking(bookingId, {
    status: "cancelled",
  })

  return updatedBooking
}

/**
 * Set time slot for a pre-order booking (warehouse worker action)
 */
export async function setBookingTimeSlot(
  bookingId: string,
  scheduledDatetime: string,
  workerId: string
): Promise<Booking> {
  // Get booking
  const booking = await getBookingById(bookingId, false)
  if (!booking) {
    throw new Error("Booking not found")
  }

  // Verify booking is in pre_order status
  if (booking.status !== "pre_order") {
    throw new Error(`Booking is not in pre_order status. Current status: ${booking.status}`)
  }

  // Validate datetime
  const datetime = new Date(scheduledDatetime)
  if (isNaN(datetime.getTime())) {
    throw new Error("Invalid datetime format")
  }

  // Update booking with time slot information
  const updatedBooking = await updateBooking(bookingId, {
    scheduledDropoffDatetime: scheduledDatetime,
    timeSlotSetBy: workerId,
    timeSlotSetAt: new Date().toISOString(),
  })

  // Send notification to customer
  try {
    const notificationService = getNotificationService()
    await notificationService.sendNotification({
      userId: booking.customerId,
      type: "booking",
      channels: ["email", "push"],
      title: "Time Slot Assigned",
      message: `A time slot has been assigned for your booking #${bookingId.slice(0, 8)}. Please confirm the time slot to proceed with payment.`,
      template: "time-slot-assigned",
      templateData: {
        bookingId: bookingId.slice(0, 8),
        scheduledDatetime: scheduledDatetime,
        customerName: booking.customerName,
      },
    })
  } catch (error) {
    // Log error but don't fail the time slot assignment
    console.error("Failed to send time slot notification:", error)
  }

  return updatedBooking
}

/**
 * Confirm time slot for a pre-order booking (customer action)
 */
export async function confirmBookingTimeSlot(
  bookingId: string,
  customerId: string
): Promise<Booking> {
  // Get booking
  const booking = await getBookingById(bookingId, false)
  if (!booking) {
    throw new Error("Booking not found")
  }

  // Verify customer owns the booking
  if (booking.customerId !== customerId) {
    throw new Error("You do not have permission to confirm this booking's time slot")
  }

  // Verify booking is in pre_order status
  if (booking.status !== "pre_order") {
    throw new Error(`Booking is not in pre_order status. Current status: ${booking.status}`)
  }

  // Verify time slot has been set
  if (!booking.scheduledDropoffDatetime) {
    throw new Error("Time slot has not been set yet. Please wait for warehouse staff to assign a time slot.")
  }

  // Update booking with confirmation timestamp and change status to payment_pending
  const updatedBooking = await updateBooking(bookingId, {
    timeSlotConfirmedAt: new Date().toISOString(),
    status: "payment_pending",
  })

  // Send notification to warehouse staff
  try {
    // Note: You might want to get warehouse staff IDs here
    // For now, we'll just log it
    console.log(`Time slot confirmed for booking ${bookingId} by customer ${customerId}`)
  } catch (error) {
    // Log error but don't fail the confirmation
    console.error("Failed to send confirmation notification:", error)
  }

  return updatedBooking
}

/**
 * Get bookings awaiting time slot assignment
 */
export async function getBookingsAwaitingTimeSlot(warehouseId: string): Promise<Booking[]> {
  return await getBookings({
    warehouseId,
    status: "pre_order",
  })
}

/**
 * Get bookings with confirmed time slots (ready for payment)
 */
export async function getBookingsWithConfirmedTimeSlots(warehouseId: string): Promise<Booking[]> {
  const bookings = await getBookings({
    warehouseId,
    status: "payment_pending",
  })
  
  // Filter to only include bookings with confirmed time slots
  return bookings.filter(booking => booking.timeSlotConfirmedAt !== undefined)
}

