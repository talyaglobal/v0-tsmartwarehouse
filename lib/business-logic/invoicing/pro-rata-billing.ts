/**
 * Pro-Rata Billing Logic
 * Calculates pro-rata billing for bookings with modifications
 */

import { getBookingUsagePeriods } from '@/features/bookings/lib/usage-tracker'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { InvoiceItem } from '@/types'

export interface ProRataCalculation {
  periodStart: Date
  periodEnd: Date
  baseQuantity: number
  finalQuantity: number
  dailyBreakdown: Array<{
    date: Date
    quantity: number
  }>
  totalDays: number
  basePrice: number
  totalAmount: number
}

/**
 * Calculate pro-rata billing for a booking period
 */
export async function calculateProRataBilling(
  bookingId: string,
  periodStart: Date,
  periodEnd: Date,
  basePrice: number,
  isPalletBooking: boolean
): Promise<ProRataCalculation> {
  const supabase = await createServerSupabaseClient()

  // Get usage period
  const usagePeriods = await getBookingUsagePeriods(bookingId)
  const period = usagePeriods.find(
    (p) =>
      p.periodStart.toISOString().split('T')[0] ===
        periodStart.toISOString().split('T')[0] &&
      p.periodEnd.toISOString().split('T')[0] ===
        periodEnd.toISOString().split('T')[0]
  )

  if (!period) {
    throw new Error('Usage period not found')
  }

  // Get modifications for this period
  const { data: modifications } = await supabase
    .from('booking_modifications')
    .select('*')
    .eq('booking_id', bookingId)
    .gte('effective_date', periodStart.toISOString().split('T')[0])
    .lte('effective_date', periodEnd.toISOString().split('T')[0])
    .order('effective_date', { ascending: true })

  // Calculate daily breakdown
  const dailyBreakdown: Array<{ date: Date; quantity: number }> = []
  const currentDate = new Date(periodStart)
  const endDate = new Date(periodEnd)

  let currentQuantity = isPalletBooking
    ? period.palletCount || 0
    : period.areaSqFt || 0

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0]

    // Check if there's a modification on this date
    const modification = modifications?.find(
      (m) => m.effective_date === dateStr
    )

    if (modification) {
      if (
        modification.modification_type === 'add_pallets' ||
        modification.modification_type === 'add_area'
      ) {
        currentQuantity = modification.new_value || currentQuantity
      } else if (
        modification.modification_type === 'remove_pallets' ||
        modification.modification_type === 'remove_area'
      ) {
        currentQuantity = modification.new_value || currentQuantity
      }
    }

    dailyBreakdown.push({
      date: new Date(currentDate),
      quantity: currentQuantity,
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Calculate total
  const totalQuantityDays = dailyBreakdown.reduce(
    (sum, day) => sum + day.quantity,
    0
  )
  const totalDays = dailyBreakdown.length
  const averageQuantity = totalQuantityDays / totalDays
  const totalAmount = (averageQuantity * basePrice * totalDays) / 30 // Assuming monthly base price

  return {
    periodStart,
    periodEnd,
    baseQuantity: isPalletBooking
      ? period.palletCount || 0
      : period.areaSqFt || 0,
    finalQuantity: currentQuantity,
    dailyBreakdown,
    totalDays,
    basePrice,
    totalAmount,
  }
}

/**
 * Generate invoice line items for a booking period
 */
export async function generateInvoiceLineItems(
  bookingId: string,
  periodStart: Date,
  periodEnd: Date,
  basePrice: number,
  isPalletBooking: boolean
): Promise<InvoiceItem[]> {
  const calculation = await calculateProRataBilling(
    bookingId,
    periodStart,
    periodEnd,
    basePrice,
    isPalletBooking
  )

  const items: InvoiceItem[] = []

  // Group consecutive days with same quantity
  let currentGroupStart = calculation.dailyBreakdown[0]?.date
  let currentQuantity = calculation.dailyBreakdown[0]?.quantity || 0

  for (let i = 1; i < calculation.dailyBreakdown.length; i++) {
    const day = calculation.dailyBreakdown[i]

    if (day.quantity !== currentQuantity) {
      // End current group, start new one
      const groupDays =
        (day.date.getTime() - (currentGroupStart?.getTime() || 0)) /
        (1000 * 60 * 60 * 24)

      items.push({
        description: `${isPalletBooking ? 'Pallet' : 'Area'} storage - ${currentGroupStart?.toLocaleDateString()} to ${day.date.toLocaleDateString()}`,
        quantity: currentQuantity,
        unitPrice: basePrice,
        total: (currentQuantity * basePrice * groupDays) / 30,
      })

      currentGroupStart = day.date
      currentQuantity = day.quantity
    }
  }

  // Add final group
  if (currentGroupStart) {
    const finalDay = calculation.dailyBreakdown[calculation.dailyBreakdown.length - 1]
    const groupDays =
      (finalDay.date.getTime() - currentGroupStart.getTime()) /
      (1000 * 60 * 60 * 24) +
      1

    items.push({
      description: `${isPalletBooking ? 'Pallet' : 'Area'} storage - ${currentGroupStart.toLocaleDateString()} to ${finalDay.date.toLocaleDateString()}`,
      quantity: currentQuantity,
      unitPrice: basePrice,
      total: (currentQuantity * basePrice * groupDays) / 30,
    })
  }

  return items
}

