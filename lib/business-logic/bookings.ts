import { createServerSupabaseClient } from "@/lib/supabase/server"
import { checkPalletCapacity, checkAreaRentalCapacity, reserveCapacity } from "./capacity"
import { calculatePalletPricing, calculateAreaRentalPricing } from "./pricing"
import { getBookings, getBookingById, createBooking, updateBooking } from "@/lib/db/bookings"
import { getNotificationService } from "@/lib/notifications/service"
import { canBookOnBehalf, isTeamAdminForBooking } from "@/lib/db/teams"
import { createApprovalRequest, approveBooking as dbApproveBooking, rejectBooking as dbRejectBooking, getPendingApprovalsForUser } from "@/lib/db/booking-approvals"
import type { Booking, BookingType, MembershipTier, BookingApproval } from "@/types"

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

// =====================================================
// On-Behalf Booking Functions (2026-01-29)
// =====================================================

export interface CreateOnBehalfBookingInput extends CreateBookingInput {
  bookedById: string      // The team admin creating the booking
  bookedByName: string    // Name of the team admin
  requiresApproval: boolean // Whether customer approval is needed
  requestMessage?: string // Optional message for approval request
}

export interface CreateOnBehalfBookingResult extends CreateBookingResult {
  approval?: BookingApproval
  bookedOnBehalf: boolean
}

/**
 * Create a booking on behalf of a team member
 * Only team admins can create bookings on behalf of team members
 */
export async function createBookingOnBehalf(
  input: CreateOnBehalfBookingInput
): Promise<CreateOnBehalfBookingResult> {
  // Step 1: Validate that booker can book on behalf of customer (same team)
  const canBook = await canBookOnBehalf(input.bookedById, input.customerId)
  if (!canBook) {
    throw new Error(
      "You do not have permission to book on behalf of this user. " +
      "You can only book on behalf of members in your team."
    )
  }

  // Step 2: Members must require approval; only team admins can create pre-approved bookings
  const isAdmin = await isTeamAdminForBooking(input.bookedById, input.customerId)
  const requiresApproval = isAdmin ? input.requiresApproval : true

  // Step 3: Create the booking using standard flow
  const result = await createBookingWithAvailability(input)

  // Step 4: Update booking with on-behalf information
  const supabase = createServerSupabaseClient()
  await supabase
    .from("bookings")
    .update({
      booked_by_id: input.bookedById,
      booked_on_behalf: true,
      requires_approval: requiresApproval,
      approval_status: requiresApproval ? "pending" : null,
    })
    .eq("id", result.booking.id)

  // Step 5: If approval is required, create approval request
  let approval: BookingApproval | undefined
  if (requiresApproval) {
    approval = await createApprovalRequest(
      result.booking.id,
      input.bookedById,
      input.bookedByName,
      input.requestMessage
    )

    // Send notification to customer about pending approval
    try {
      const notificationService = getNotificationService()
      await notificationService.sendNotification({
        userId: input.customerId,
        type: "booking",
        channels: ["email", "push"],
        title: "Booking Approval Required",
        message: `${input.bookedByName} has created a booking on your behalf. Please review and approve or reject the booking.`,
        template: "booking-approval-required",
        templateData: {
          bookingId: result.booking.id.slice(0, 8),
          bookedByName: input.bookedByName,
          bookingType: input.type,
          quantity: input.type === "pallet" ? input.palletCount : input.areaSqFt,
          customerName: input.customerName,
          requestMessage: input.requestMessage,
        },
      })
    } catch (error) {
      console.error("Failed to send approval notification:", error)
    }
  } else {
    // No approval needed - send confirmation notification
    try {
      const notificationService = getNotificationService()
      await notificationService.sendNotification({
        userId: input.customerId,
        type: "booking",
        channels: ["email", "push"],
        title: "Booking Created on Your Behalf",
        message: `${input.bookedByName} has created a booking on your behalf.`,
        template: "booking-created-on-behalf",
        templateData: {
          bookingId: result.booking.id.slice(0, 8),
          bookedByName: input.bookedByName,
          bookingType: input.type,
          quantity: input.type === "pallet" ? input.palletCount : input.areaSqFt,
          customerName: input.customerName,
        },
      })
    } catch (error) {
      console.error("Failed to send on-behalf notification:", error)
    }
  }

  return {
    ...result,
    approval,
    bookedOnBehalf: true,
    message: requiresApproval
      ? "Booking created. Waiting for customer approval."
      : "Booking created successfully on behalf of team member.",
  }
}

/**
 * Approve a booking that was created on behalf
 */
export async function approveOnBehalfBooking(
  bookingId: string,
  customerId: string,
  customerName: string,
  responseMessage?: string
): Promise<BookingApproval> {
  // Get booking to verify customer
  const booking = await getBookingById(bookingId, false)
  if (!booking) {
    throw new Error("Booking not found")
  }

  if (booking.customerId !== customerId) {
    throw new Error("You can only approve bookings made on your behalf")
  }

  if (!booking.bookedOnBehalf || !booking.requiresApproval) {
    throw new Error("This booking does not require approval")
  }

  if (booking.approvalStatus !== "pending") {
    throw new Error(`Booking has already been ${booking.approvalStatus}`)
  }

  const approval = await dbApproveBooking(
    bookingId,
    customerId,
    customerName,
    responseMessage
  )

  // Notify the person who booked
  try {
    const notificationService = getNotificationService()
    await notificationService.sendNotification({
      userId: booking.bookedById!,
      type: "booking",
      channels: ["email", "push"],
      title: "Booking Approved",
      message: `${customerName} has approved the booking #${bookingId.slice(0, 8)} you created on their behalf.`,
      template: "booking-approved",
      templateData: {
        bookingId: bookingId.slice(0, 8),
        customerName,
        responseMessage,
      },
    })
  } catch (error) {
    console.error("Failed to send approval notification:", error)
  }

  return approval
}

/**
 * Reject a booking that was created on behalf
 */
export async function rejectOnBehalfBooking(
  bookingId: string,
  customerId: string,
  customerName: string,
  responseMessage?: string
): Promise<BookingApproval> {
  // Get booking to verify customer
  const booking = await getBookingById(bookingId, false)
  if (!booking) {
    throw new Error("Booking not found")
  }

  if (booking.customerId !== customerId) {
    throw new Error("You can only reject bookings made on your behalf")
  }

  if (!booking.bookedOnBehalf || !booking.requiresApproval) {
    throw new Error("This booking does not require approval")
  }

  if (booking.approvalStatus !== "pending") {
    throw new Error(`Booking has already been ${booking.approvalStatus}`)
  }

  const approval = await dbRejectBooking(
    bookingId,
    customerId,
    customerName,
    responseMessage
  )

  // Notify the person who booked
  try {
    const notificationService = getNotificationService()
    await notificationService.sendNotification({
      userId: booking.bookedById!,
      type: "booking",
      channels: ["email", "push"],
      title: "Booking Rejected",
      message: `${customerName} has rejected the booking #${bookingId.slice(0, 8)} you created on their behalf.`,
      template: "booking-rejected",
      templateData: {
        bookingId: bookingId.slice(0, 8),
        customerName,
        responseMessage,
      },
    })
  } catch (error) {
    console.error("Failed to send rejection notification:", error)
  }

  return approval
}

/**
 * Get pending booking approvals for a user
 */
export async function getPendingBookingApprovals(
  userId: string
): Promise<BookingApproval[]> {
  return await getPendingApprovalsForUser(userId)
}

