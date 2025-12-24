/**
 * Dynamic Pricing Logic
 * Calculates pricing with volume discounts and membership tiers
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface PricingCalculation {
  basePrice: number
  quantity: number
  volumeDiscount: number
  membershipDiscount: number
  subtotal: number
  totalDiscount: number
  finalPrice: number
  breakdown: {
    baseAmount: number
    volumeDiscountAmount: number
    membershipDiscountAmount: number
  }
}

export interface VolumeDiscount {
  threshold: number
  discountPercent: number
}

/**
 * Calculate pallet pricing with discounts
 */
export async function calculatePalletPricing(
  warehouseId: string,
  palletCount: number,
  membershipTier?: 'bronze' | 'silver' | 'gold' | 'platinum'
): Promise<PricingCalculation> {
  const supabase = await createServerSupabaseClient()

  // Get warehouse pricing
  const { data: pricing, error } = await supabase
    .from('warehouse_pricing')
    .select('*')
    .eq('warehouse_id', warehouseId)
    .eq('pricing_type', 'pallet')
    .single()

  if (error || !pricing) {
    throw new Error('Pricing not found for warehouse')
  }

  const basePrice = parseFloat(pricing.base_price.toString())
  const volumeDiscounts = (pricing.volume_discounts as Record<string, number>) || {}

  // Calculate volume discount
  let volumeDiscountPercent = 0
  const sortedThresholds = Object.keys(volumeDiscounts)
    .map(Number)
    .sort((a, b) => b - a) // Descending order

  for (const threshold of sortedThresholds) {
    if (palletCount >= threshold) {
      volumeDiscountPercent = volumeDiscounts[threshold.toString()]
      break
    }
  }

  // Calculate membership discount
  const membershipDiscountPercent = getMembershipDiscount(membershipTier)

  // Calculate amounts
  const baseAmount = basePrice * palletCount
  const volumeDiscountAmount = (baseAmount * volumeDiscountPercent) / 100
  const membershipDiscountAmount =
    ((baseAmount - volumeDiscountAmount) * membershipDiscountPercent) / 100

  const subtotal = baseAmount
  const totalDiscount = volumeDiscountAmount + membershipDiscountAmount
  const finalPrice = subtotal - totalDiscount

  return {
    basePrice,
    quantity: palletCount,
    volumeDiscount: volumeDiscountPercent,
    membershipDiscount: membershipDiscountPercent,
    subtotal,
    totalDiscount,
    finalPrice,
    breakdown: {
      baseAmount,
      volumeDiscountAmount,
      membershipDiscountAmount,
    },
  }
}

/**
 * Calculate area rental pricing with discounts
 */
export async function calculateAreaRentalPricing(
  warehouseId: string,
  areaSqFt: number,
  membershipTier?: 'bronze' | 'silver' | 'gold' | 'platinum'
): Promise<PricingCalculation> {
  const supabase = await createServerSupabaseClient()

  // Get warehouse pricing
  const { data: pricing, error } = await supabase
    .from('warehouse_pricing')
    .select('*')
    .eq('warehouse_id', warehouseId)
    .eq('pricing_type', 'area')
    .single()

  if (error || !pricing) {
    throw new Error('Pricing not found for warehouse')
  }

  const basePrice = parseFloat(pricing.base_price.toString())
  const volumeDiscounts = (pricing.volume_discounts as Record<string, number>) || {}

  // Calculate volume discount based on area
  let volumeDiscountPercent = 0
  const sortedThresholds = Object.keys(volumeDiscounts)
    .map(Number)
    .sort((a, b) => b - a)

  for (const threshold of sortedThresholds) {
    if (areaSqFt >= threshold) {
      volumeDiscountPercent = volumeDiscounts[threshold.toString()]
      break
    }
  }

  // Calculate membership discount
  const membershipDiscountPercent = getMembershipDiscount(membershipTier)

  // Calculate amounts
  const baseAmount = basePrice * areaSqFt
  const volumeDiscountAmount = (baseAmount * volumeDiscountPercent) / 100
  const membershipDiscountAmount =
    ((baseAmount - volumeDiscountAmount) * membershipDiscountPercent) / 100

  const subtotal = baseAmount
  const totalDiscount = volumeDiscountAmount + membershipDiscountAmount
  const finalPrice = subtotal - totalDiscount

  return {
    basePrice,
    quantity: areaSqFt,
    volumeDiscount: volumeDiscountPercent,
    membershipDiscount: membershipDiscountPercent,
    subtotal,
    totalDiscount,
    finalPrice,
    breakdown: {
      baseAmount,
      volumeDiscountAmount,
      membershipDiscountAmount,
    },
  }
}

/**
 * Get membership discount percentage
 */
function getMembershipDiscount(
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum'
): number {
  switch (tier) {
    case 'bronze':
      return 0
    case 'silver':
      return 5
    case 'gold':
      return 10
    case 'platinum':
      return 15
    default:
      return 0
  }
}

