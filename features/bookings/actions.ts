/**
 * Bookings Server Actions
 * Handles all booking-related mutations
 */

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createBooking, getBookings, updateBooking } from '@/lib/db/bookings'
import { createAuthenticatedSupabaseClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/utils'
import { success, failure, type Result } from '@/lib/shared/result'
import { PRICING } from '@/lib/constants'
import type { Booking } from '@/types'

// Validation schemas
const createBookingSchema = z.object({
  type: z.enum(['pallet', 'area-rental']),
  palletCount: z.number().positive().optional(),
  areaSqFt: z.number().positive().optional(),
  floorNumber: z.number().int().min(1).max(3).optional(),
  hallId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().optional(),
})

const updateBookingSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'confirmed', 'active', 'completed', 'cancelled']).optional(),
  palletCount: z.number().positive().optional(),
  areaSqFt: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  notes: z.string().optional(),
})

/**
 * Create a new booking
 */
export async function createBookingAction(
  input: z.infer<typeof createBookingSchema>
): Promise<Result<Booking, string>> {
  try {
    // Validate input
    const validated = createBookingSchema.parse(input)

    // Authenticate user
    const user = await requireAuth()
    if (!user) {
      return failure('Authentication required')
    }

    // Get user profile
    const supabase = await createAuthenticatedSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return failure('User profile not found')
    }

    // Calculate pricing
    let totalAmount = 0
    if (validated.type === 'pallet' && validated.palletCount) {
      const handlingIn = validated.palletCount * PRICING.palletIn
      const storage = validated.palletCount * PRICING.storagePerPalletPerMonth
      totalAmount = handlingIn + storage
    } else if (validated.type === 'area-rental' && validated.areaSqFt) {
      if (validated.areaSqFt < PRICING.areaRentalMinSqFt) {
        return failure(`Minimum area rental is ${PRICING.areaRentalMinSqFt} sq ft`)
      }
      totalAmount = validated.areaSqFt * PRICING.areaRentalPerSqFtPerYear
    }

    // Get default warehouse ID
    const defaultWarehouseId = process.env.DEFAULT_WAREHOUSE_ID || validated.warehouseId || 'wh-001'

    // Create booking
    const booking = await createBooking({
      customerId: user.id,
      customerName: profile.name || user.email || '',
      customerEmail: profile.email || user.email || '',
      warehouseId: defaultWarehouseId,
      type: validated.type,
      status: 'pending',
      palletCount: validated.type === 'pallet' ? validated.palletCount : undefined,
      areaSqFt: validated.type === 'area-rental' ? validated.areaSqFt : undefined,
      floorNumber: validated.type === 'area-rental' ? (validated.floorNumber ?? 3) as 3 : undefined,
      hallId: validated.type === 'area-rental' ? validated.hallId : undefined,
      startDate: validated.startDate,
      endDate: validated.endDate || undefined,
      totalAmount,
      notes: validated.notes || undefined,
    })

    // Revalidate relevant paths
    revalidatePath('/dashboard/bookings')
    revalidatePath('/admin/bookings')

    return success(booking)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return failure(error.errors[0].message)
    }
    console.error('Create booking error:', error)
    return failure('Failed to create booking')
  }
}

/**
 * Update booking status or details
 */
export async function updateBookingAction(
  input: z.infer<typeof updateBookingSchema>
): Promise<Result<Booking, string>> {
  try {
    const validated = updateBookingSchema.parse(input)
    const user = await requireAuth()

    if (!user) {
      return failure('Authentication required')
    }

    // Check if user owns the booking or is admin
    const bookings = await getBookings({ customerId: user.id })
    const booking = bookings.find((b) => b.id === validated.id)

    if (!booking) {
      return failure('Booking not found')
    }

    // Only allow status updates for now
    const updated = await updateBooking(validated.id, {
      status: validated.status,
      palletCount: validated.palletCount,
      areaSqFt: validated.areaSqFt,
      startDate: validated.startDate,
      endDate: validated.endDate,
      notes: validated.notes,
    })

    revalidatePath('/dashboard/bookings')
    revalidatePath('/admin/bookings')
    revalidatePath(`/dashboard/bookings/${validated.id}`)

    return success(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return failure(error.errors[0].message)
    }
    console.error('Update booking error:', error)
    return failure('Failed to update booking')
  }
}

/**
 * Cancel a booking
 */
export async function cancelBookingAction(bookingId: string): Promise<Result<Booking, string>> {
  try {
    const user = await requireAuth()

    if (!user) {
      return failure('Authentication required')
    }

    const bookings = await getBookings({ customerId: user.id })
    const booking = bookings.find((b) => b.id === bookingId)

    if (!booking) {
      return failure('Booking not found')
    }

    if (booking.status === 'cancelled') {
      return failure('Booking is already cancelled')
    }

    const updated = await updateBooking(bookingId, { status: 'cancelled' })

    revalidatePath('/dashboard/bookings')
    revalidatePath(`/dashboard/bookings/${bookingId}`)

    return success(updated)
  } catch (error) {
    console.error('Cancel booking error:', error)
    return failure('Failed to cancel booking')
  }
}

