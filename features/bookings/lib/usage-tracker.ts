/**
 * Usage Tracker
 * Tracks booking usage for pro-rata billing
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface UsagePeriod {
  id: string
  bookingId: string
  periodStart: Date
  periodEnd: Date
  palletCount?: number
  areaSqFt?: number
  dailyUsage: Record<string, { palletCount?: number; areaSqFt?: number }>
  totalDays: number
  createdAt: Date
}

/**
 * Create or update usage period for a booking
 */
export async function trackBookingUsage(
  bookingId: string,
  periodStart: Date,
  periodEnd: Date,
  palletCount?: number,
  areaSqFt?: number
): Promise<UsagePeriod> {
  const supabase = await createServerSupabaseClient()

  // Calculate daily usage
  const dailyUsage: Record<string, { palletCount?: number; areaSqFt?: number }> =
    {}
  const currentDate = new Date(periodStart)
  const endDate = new Date(periodEnd)

  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0]
    dailyUsage[dateKey] = {
      palletCount,
      areaSqFt,
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  const totalDays = Math.ceil(
    (endDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Upsert usage period
  const { data, error } = await supabase
    .from('booking_usage_periods')
    .upsert(
      {
        booking_id: bookingId,
        period_start: periodStart.toISOString().split('T')[0],
        period_end: periodEnd.toISOString().split('T')[0],
        pallet_count: palletCount,
        area_sq_ft: areaSqFt,
        daily_usage: dailyUsage,
        total_days: totalDays,
      },
      {
        onConflict: 'booking_id,period_start',
      }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to track usage: ${error.message}`)
  }

  return transformUsagePeriod(data)
}

/**
 * Update daily usage for a specific date
 */
export async function updateDailyUsage(
  bookingId: string,
  date: Date,
  palletCount?: number,
  areaSqFt?: number
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  // Find the usage period for this date
  const dateStr = date.toISOString().split('T')[0]

  const { data: periods } = await supabase
    .from('booking_usage_periods')
    .select('*')
    .eq('booking_id', bookingId)
    .lte('period_start', dateStr)
    .gte('period_end', dateStr)

  if (!periods || periods.length === 0) {
    throw new Error('Usage period not found for date')
  }

  const period = periods[0]
  const dailyUsage = (period.daily_usage as Record<string, any>) || {}

  // Update daily usage
  dailyUsage[dateStr] = {
    palletCount,
    areaSqFt,
  }

  // Update period
  await supabase
    .from('booking_usage_periods')
    .update({
      daily_usage: dailyUsage,
      pallet_count: palletCount,
      area_sq_ft: areaSqFt,
    })
    .eq('id', period.id)
}

/**
 * Get usage periods for a booking
 */
export async function getBookingUsagePeriods(
  bookingId: string
): Promise<UsagePeriod[]> {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('booking_usage_periods')
    .select('*')
    .eq('booking_id', bookingId)
    .order('period_start', { ascending: true })

  if (error) {
    throw new Error(`Failed to get usage periods: ${error.message}`)
  }

  return (data || []).map(transformUsagePeriod)
}

/**
 * Transform database row to UsagePeriod
 */
function transformUsagePeriod(row: any): UsagePeriod {
  return {
    id: row.id,
    bookingId: row.booking_id,
    periodStart: new Date(row.period_start),
    periodEnd: new Date(row.period_end),
    palletCount: row.pallet_count,
    areaSqFt: row.area_sq_ft,
    dailyUsage: (row.daily_usage as Record<string, any>) || {},
    totalDays: row.total_days,
    createdAt: new Date(row.created_at),
  }
}

