/**
 * Pricing Service
 * 
 * Calculates dynamic pricing for warehouse bookings
 * Handles volume discounts, date-based price overrides, and different pricing units
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { PriceCalculation, PriceBreakdown, PalletBookingDetails } from '@/types/marketplace'
import { getFreeStorageDays } from '@/lib/utils/free-storage'

const normalizeGoodsType = (value?: string) => (value || 'general').trim().toLowerCase()

const findRangePrice = <T extends { [key: string]: number }>(
  ranges: T[] | undefined,
  value: number | undefined,
  minKey: keyof T,
  maxKey: keyof T,
  priceKey: keyof T
) => {
  if (!ranges || ranges.length === 0 || value == null) return 0
  const match = ranges.find((range) => value >= Number(range[minKey]) && value <= Number(range[maxKey]))
  return match ? Number(match[priceKey]) : 0
}

const getUnitsForPeriod = (period: string, billableDays: number) => {
  if (period === 'month') return Math.ceil(billableDays / 30)
  if (period === 'week') return Math.ceil(billableDays / 7)
  return billableDays
}

const pickPricingPeriod = (
  availablePeriods: Set<string>,
  billableDays: number
) => {
  if (billableDays >= 30 && availablePeriods.has('month')) return 'month'
  if (billableDays >= 7 && availablePeriods.has('week')) return 'week'
  if (availablePeriods.has('day')) return 'day'
  if (availablePeriods.has('week')) return 'week'
  if (availablePeriods.has('month')) return 'month'
  return 'day'
}

async function calculatePalletDetailsPrice(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  warehouseId: string,
  startDate: string,
  endDate: string,
  palletDetails: PalletBookingDetails
): Promise<PriceBreakdown> {
  const { data: warehouseData } = await supabase
    .from('warehouses')
    .select('free_storage_rules')
    .eq('id', warehouseId)
    .single()

  const { data: palletPricingRows, error } = await supabase
    .from('warehouse_pallet_pricing')
    .select(`
      id,
      pallet_type,
      pricing_period,
      goods_type,
      stackable_adjustment_type,
      stackable_adjustment_value,
      unstackable_adjustment_type,
      unstackable_adjustment_value,
      warehouse_pallet_height_pricing(id, height_min_cm, height_max_cm, price_per_unit),
      warehouse_pallet_weight_pricing(id, weight_min_kg, weight_max_kg, price_per_pallet)
    `)
    .eq('warehouse_id', warehouseId)
    .eq('status', true)

  if (error || !palletPricingRows) {
    throw error || new Error('Pallet pricing not found')
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const freeDays = getFreeStorageDays(warehouseData?.free_storage_rules, days)
  const billableDays = Math.max(0, days - freeDays)

  const goodsTypeKey = normalizeGoodsType(palletDetails.goods_type)
  const pricingForGoodsType = palletPricingRows.filter(
    (row) => normalizeGoodsType(row.goods_type) === goodsTypeKey
  )
  const fallbackPricing = palletPricingRows.filter(
    (row) => normalizeGoodsType(row.goods_type) === 'general'
  )
  const pricingRows = pricingForGoodsType.length > 0 ? pricingForGoodsType : fallbackPricing

  let subtotal = 0
  let totalQuantity = 0

  palletDetails.pallets.forEach((pallet) => {
    const quantity = Math.max(0, pallet.quantity || 0)
    if (!quantity) return

    const palletType = pallet.pallet_type
    const rowsForType = pricingRows.filter((row) => row.pallet_type === palletType)
    if (rowsForType.length === 0) return

    const availablePeriods = new Set(rowsForType.map((row) => row.pricing_period))
    const period = pickPricingPeriod(availablePeriods, billableDays)
    const pricingRow = rowsForType.find((row) => row.pricing_period === period) || rowsForType[0]
    const heightPrice = findRangePrice(
      pricingRow.warehouse_pallet_height_pricing,
      pallet.height_cm,
      'height_min_cm',
      'height_max_cm',
      'price_per_unit'
    )
    const weightPrice = findRangePrice(
      pricingRow.warehouse_pallet_weight_pricing,
      pallet.weight_kg,
      'weight_min_kg',
      'weight_max_kg',
      'price_per_pallet'
    )
    const baseUnitPrice = heightPrice + weightPrice

    const adjustmentType = palletDetails.stackable
      ? pricingRow.stackable_adjustment_type
      : pricingRow.unstackable_adjustment_type
    const adjustmentValue = palletDetails.stackable
      ? pricingRow.stackable_adjustment_value
      : pricingRow.unstackable_adjustment_value
    let adjustedUnitPrice = baseUnitPrice

    if (adjustmentType === 'rate' && adjustmentValue) {
      adjustedUnitPrice = baseUnitPrice * (1 + Number(adjustmentValue) / 100)
    } else if (adjustmentType === 'plus_per_unit' && adjustmentValue) {
      adjustedUnitPrice = baseUnitPrice + Number(adjustmentValue)
    }

    const units = getUnitsForPeriod(pricingRow.pricing_period, billableDays)
    subtotal += adjustedUnitPrice * quantity * units
    totalQuantity += quantity
  })

  const basePrice = totalQuantity > 0 ? subtotal / totalQuantity : 0

  return {
    base_price: basePrice,
    quantity: totalQuantity,
    days,
    billable_days: billableDays,
    free_days: freeDays,
    subtotal,
    volume_discount: 0,
    discount_percent: 0,
    total: subtotal,
    currency: 'USD',
  }
}

/**
 * Calculate price for a booking
 */
export async function calculatePrice(
  params: PriceCalculation
): Promise<PriceBreakdown> {
  const supabase = createServerSupabaseClient()
  const { warehouse_id, type, quantity, start_date, end_date, pallet_details } = params

  try {
    if (type === 'pallet' && pallet_details) {
      return await calculatePalletDetailsPrice(
        supabase,
        warehouse_id,
        start_date,
        end_date,
        pallet_details
      )
    }

    const { data: warehouseData } = await supabase
      .from('warehouses')
      .select('free_storage_rules')
      .eq('id', warehouse_id)
      .single()

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

    const freeDays = getFreeStorageDays(warehouseData?.free_storage_rules, days)
    const billableDays = Math.max(0, days - freeDays)

    // Calculate base total
    // For area-rental, always use months regardless of unit in database
    const unit = pricing.unit || (type === 'area-rental' ? 'month' : 'day')
    let units = billableDays

    if (type === 'area-rental') {
      // For area-rental, calculate based on months
      // Calculate months: (end_date - start_date) / 30 days, rounded up
      units = Math.ceil(billableDays / 30)
    } else if (unit === 'month') {
      units = Math.ceil(billableDays / 30)
    } else if (unit === 'week') {
      units = Math.ceil(billableDays / 7)
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
      billable_days: billableDays,
      free_days: freeDays,
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
