/**
 * Pricing Service
 * 
 * Calculates dynamic pricing for warehouse bookings
 * Handles volume discounts, date-based price overrides, and different pricing units
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { PriceCalculation, PriceBreakdown } from '@/types/marketplace'

/**
 * Calculate price for a booking
 */
export async function calculatePrice(
  params: PriceCalculation
): Promise<PriceBreakdown> {
  const supabase = createServerSupabaseClient()
  const { warehouse_id, type, quantity, start_date, end_date } = params

  try {
    // Get pricing - support both 'area' and 'area-rental' for backward compatibility
    const { data: pricing, error } = await supabase
      .from('warehouse_pricing')
      .select('base_price, unit, volume_discounts')
      .eq('warehouse_id', warehouse_id)
      .in('pricing_type', type === 'pallet' ? ['pallet'] : ['area-rental', 'area'])
      .eq('status', true)
      .single()

    if (error || !pricing) {
      throw error || new Error('Pricing not found')
    }

    // Calculate days
    const start = new Date(start_date)
    const end = new Date(end_date)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Check for date-based price overrides in availability calendar
    const { data: availabilityEntries } = await supabase
      .from('warehouse_availability')
      .select('date, pallet_price_override, area_price_override')
      .eq('warehouse_id', warehouse_id)
      .gte('date', start_date)
      .lte('date', end_date)
      .order('date', { ascending: true })

    // Calculate base price per unit
    let basePricePerUnit = parseFloat(pricing.base_price) || 0

    // Check if there are price overrides
    const priceOverrides = (availabilityEntries || [])
      .filter((entry) => {
        if (type === 'pallet') {
          return entry.pallet_price_override !== null
        } else {
          return entry.area_price_override !== null
        }
      })
      .map((entry) => {
        if (type === 'pallet') {
          return parseFloat(entry.pallet_price_override) || basePricePerUnit
        } else {
          return parseFloat(entry.area_price_override) || basePricePerUnit
        }
      })

    // Use average of overrides if any, otherwise use base price
    if (priceOverrides.length > 0) {
      basePricePerUnit = priceOverrides.reduce((sum, p) => sum + p, 0) / priceOverrides.length
    }

    // Calculate base total
    const unit = pricing.unit || 'day'
    let units = days

    if (unit === 'month') {
      units = Math.ceil(days / 30)
    } else if (unit === 'week') {
      units = Math.ceil(days / 7)
    }

    const subtotal = basePricePerUnit * quantity * units

    // Apply volume discount if applicable
    let discountPercent = 0
    const volumeDiscounts = pricing.volume_discounts as { min: number; discount: number }[] | null

    if (volumeDiscounts && Array.isArray(volumeDiscounts)) {
      // Sort by min quantity descending to find the best match
      const sortedDiscounts = [...volumeDiscounts].sort((a, b) => b.min - a.min)
      for (const tier of sortedDiscounts) {
        if (quantity >= tier.min) {
          discountPercent = tier.discount
          break
        }
      }
    }

    const volumeDiscount = subtotal * (discountPercent / 100)
    const total = subtotal - volumeDiscount

    return {
      base_price: basePricePerUnit,
      quantity,
      days,
      subtotal,
      volume_discount: volumeDiscount,
      discount_percent: discountPercent,
      total,
      currency: 'USD',
    }
  } catch (error) {
    console.error('[pricing] Error calculating price:', error)
    throw error
  }
}

/**
 * Get pricing information for a warehouse
 */
export async function getWarehousePricing(warehouseId: string) {
  const supabase = createServerSupabaseClient()

  try {
    const { data: pricing, error } = await supabase
      .from('warehouse_pricing')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .eq('status', true)
      .order('pricing_type', { ascending: true })

    if (error) {
      throw error
    }

    return (pricing || []).map((p: any) => ({
      id: p.id,
      warehouseId: p.warehouse_id,
      pricingType: p.pricing_type,
      basePrice: parseFloat(p.base_price) || 0,
      unit: p.unit,
      volumeDiscounts: p.volume_discounts || [],
    }))
  } catch (error) {
    console.error('[pricing] Error fetching warehouse pricing:', error)
    return []
  }
}
