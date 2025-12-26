import { PRICING } from "@/lib/constants"
import type { MembershipTier, PricingConfig } from "@/types"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getMembershipSettingByTier } from "@/lib/db/membership"

/**
 * Business Logic: Pricing Calculation with Discounts
 * 
 * Calculates pricing for bookings with:
 * - Warehouse-specific pricing from warehouse_pricing table
 * - Volume discounts based on pallet count
 * - Membership tier discounts (dynamic from membership_settings)
 * - Combined discount application
 */

export interface PricingCalculationInput {
  type: "pallet" | "area-rental"
  warehouseId: string // Required for dynamic pricing
  palletCount?: number
  areaSqFt?: number
  months?: number
  membershipTier?: MembershipTier
  existingPalletCount?: number // For cumulative volume discounts
}

export interface PricingCalculationResult {
  baseAmount: number
  volumeDiscount: number
  volumeDiscountPercent: number
  membershipDiscount: number
  membershipDiscountPercent: number
  subtotal: number
  totalDiscount: number
  totalDiscountPercent: number
  finalAmount: number
  breakdown: {
    item: string
    quantity: number
    unitPrice: number
    total: number
  }[]
}

interface WarehousePricingData {
  base_price: number
  unit: string
  min_quantity?: number
  max_quantity?: number
  volume_discounts?: Record<string, number>
}

/**
 * Get warehouse pricing from database
 */
async function getWarehousePricing(
  warehouseId: string,
  pricingType: 'pallet' | 'area'
): Promise<WarehousePricingData | null> {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('warehouse_pricing')
    .select('base_price, unit, min_quantity, max_quantity, volume_discounts')
    .eq('warehouse_id', warehouseId)
    .eq('pricing_type', pricingType)
    .eq('status', true)
    .single()

  if (error || !data) {
    return null // Return null if pricing not found, will fall back to static pricing
  }

  return {
    base_price: parseFloat(data.base_price.toString()),
    unit: data.unit,
    min_quantity: data.min_quantity || undefined,
    max_quantity: data.max_quantity || undefined,
    volume_discounts: (data.volume_discounts as Record<string, number>) || undefined,
  }
}

/**
 * Calculate pricing for a pallet booking
 */
export async function calculatePalletPricing(
  input: PricingCalculationInput,
  config?: PricingConfig // Optional fallback config
): Promise<PricingCalculationResult> {
  if (input.type !== "pallet" || !input.palletCount) {
    throw new Error("Pallet count is required for pallet bookings")
  }

  const palletCount = input.palletCount
  const months = input.months || 1
  const totalPalletCount = (input.existingPalletCount || 0) + palletCount

  // Try to get warehouse-specific pricing
  let warehousePricing: WarehousePricingData | null = null
  let useWarehousePricing = false

  if (input.warehouseId) {
    warehousePricing = await getWarehousePricing(input.warehouseId, 'pallet')
    if (warehousePricing) {
      useWarehousePricing = true
    }
  }

  // Use warehouse pricing or fall back to static config
  const pricingConfig = config || PRICING
  let storagePerPalletPerMonth: number
  let palletInCost: number
  let volumeDiscountsConfig: Array<{ palletThreshold: number; discountPercent: number }>

  if (useWarehousePricing && warehousePricing) {
    // Parse unit to determine pricing structure
    // Expected units: 'per_pallet_per_month', 'per_pallet', etc.
    if (warehousePricing.unit.includes('per_month')) {
      storagePerPalletPerMonth = warehousePricing.base_price
      palletInCost = 0 // Assume handling cost is separate or included
    } else {
      // If unit is per_pallet, treat as monthly storage
      storagePerPalletPerMonth = warehousePricing.base_price
      palletInCost = 0
    }

    // Convert volume_discounts from Record<string, number> to array format
    volumeDiscountsConfig = warehousePricing.volume_discounts
      ? Object.entries(warehousePricing.volume_discounts).map(([threshold, discount]) => ({
          palletThreshold: parseInt(threshold, 10),
          discountPercent: discount,
        }))
      : pricingConfig.volumeDiscounts
  } else {
    // Fall back to static pricing
    storagePerPalletPerMonth = pricingConfig.storagePerPalletPerMonth
    palletInCost = palletCount * pricingConfig.palletIn
    volumeDiscountsConfig = pricingConfig.volumeDiscounts
  }

  // Calculate base amounts
  const storageCost = palletCount * storagePerPalletPerMonth * months
  const baseAmount = palletInCost + storageCost

  // Calculate volume discount using warehouse pricing or static config
  const volumeDiscountInfo = calculateVolumeDiscount(totalPalletCount, {
    ...pricingConfig,
    volumeDiscounts: volumeDiscountsConfig,
  })
  const volumeDiscount = (baseAmount * volumeDiscountInfo.discountPercent) / 100

  // Get membership discount from database (dynamic)
  let membershipDiscountPercent = 0
  if (input.membershipTier) {
    try {
      const membershipSetting = await getMembershipSettingByTier(input.membershipTier)
      if (membershipSetting) {
        membershipDiscountPercent = membershipSetting.discountPercent
      }
    } catch (error) {
      // Fall back to static config if database lookup fails
      const membershipDiscountInfo = calculateMembershipDiscount(
        input.membershipTier,
        pricingConfig
      )
      membershipDiscountPercent = membershipDiscountInfo.discountPercent
    }
  }

  const amountAfterVolumeDiscount = baseAmount - volumeDiscount
  const membershipDiscount =
    (amountAfterVolumeDiscount * membershipDiscountPercent) / 100

  // Calculate totals
  const subtotal = baseAmount
  const totalDiscount = volumeDiscount + membershipDiscount
  const totalDiscountPercent =
    baseAmount > 0 ? (totalDiscount / baseAmount) * 100 : 0
  const finalAmount = baseAmount - totalDiscount

  // Build breakdown
  const breakdown = []
  if (palletInCost > 0) {
    breakdown.push({
      item: "Pallet In",
      quantity: palletCount,
      unitPrice: pricingConfig.palletIn,
      total: palletInCost,
    })
  }
  breakdown.push({
    item: `Storage (${months} month${months > 1 ? "s" : ""})`,
    quantity: palletCount,
    unitPrice: storagePerPalletPerMonth * months,
    total: storageCost,
  })

  return {
    baseAmount,
    volumeDiscount,
    volumeDiscountPercent: volumeDiscountInfo.discountPercent,
    membershipDiscount,
    membershipDiscountPercent,
    subtotal,
    totalDiscount,
    totalDiscountPercent,
    finalAmount: Math.max(0, finalAmount), // Ensure non-negative
    breakdown,
  }
}

/**
 * Calculate pricing for an area rental booking
 */
export async function calculateAreaRentalPricing(
  input: PricingCalculationInput,
  config?: PricingConfig // Optional fallback config
): Promise<PricingCalculationResult> {
  if (input.type !== "area-rental" || !input.areaSqFt) {
    throw new Error("Area square footage is required for area rental bookings")
  }

  const areaSqFt = input.areaSqFt

  // Try to get warehouse-specific pricing
  let warehousePricing: WarehousePricingData | null = null
  let useWarehousePricing = false

  if (input.warehouseId) {
    warehousePricing = await getWarehousePricing(input.warehouseId, 'area')
    if (warehousePricing) {
      useWarehousePricing = true
    }
  }

  // Use warehouse pricing or fall back to static config
  const pricingConfig = config || PRICING
  let areaRentalPerSqFt: number
  let areaRentalMinSqFt: number

  if (useWarehousePricing && warehousePricing) {
    areaRentalMinSqFt = warehousePricing.min_quantity || 40000

    // Check minimum quantity
    if (areaSqFt < areaRentalMinSqFt) {
      throw new Error(
        `Minimum area rental is ${areaRentalMinSqFt} sq ft`
      )
    }

    // Parse unit to determine pricing structure
    // Expected units: 'per_sqft_per_month', 'per_sqft_per_year'
    if (warehousePricing.unit.includes('per_year')) {
      areaRentalPerSqFt = warehousePricing.base_price / 12 // Convert yearly to monthly equivalent
    } else if (warehousePricing.unit.includes('per_month')) {
      areaRentalPerSqFt = warehousePricing.base_price
    } else {
      // Default to monthly if unit format is unclear
      areaRentalPerSqFt = warehousePricing.base_price
    }
  } else {
    // Fall back to static pricing
    areaRentalMinSqFt = pricingConfig.areaRentalMinSqFt
    if (areaSqFt < areaRentalMinSqFt) {
      throw new Error(
        `Minimum area rental is ${areaRentalMinSqFt} sq ft`
      )
    }
    // Convert yearly to monthly equivalent for calculation
    areaRentalPerSqFt = pricingConfig.areaRentalPerSqFtPerYear / 12
  }

  // Calculate base amount (for display, use yearly equivalent if original was yearly)
  const months = input.months || 1
  const baseAmount = areaSqFt * areaRentalPerSqFt * months

  // Area rentals typically don't get volume discounts, only membership
  const volumeDiscount = 0
  const volumeDiscountPercent = 0

  // Get membership discount from database (dynamic)
  let membershipDiscountPercent = 0
  if (input.membershipTier) {
    try {
      const membershipSetting = await getMembershipSettingByTier(input.membershipTier)
      if (membershipSetting) {
        membershipDiscountPercent = membershipSetting.discountPercent
      }
    } catch (error) {
      // Fall back to static config if database lookup fails
      const membershipDiscountInfo = calculateMembershipDiscount(
        input.membershipTier,
        pricingConfig
      )
      membershipDiscountPercent = membershipDiscountInfo.discountPercent
    }
  }

  const membershipDiscount =
    (baseAmount * membershipDiscountPercent) / 100

  // Calculate totals
  const subtotal = baseAmount
  const totalDiscount = membershipDiscount
  const totalDiscountPercent =
    baseAmount > 0 ? (totalDiscount / baseAmount) * 100 : 0
  const finalAmount = baseAmount - totalDiscount

  // Build breakdown
  const breakdown = [
    {
      item: `Area Rental (${months} month${months > 1 ? "s" : ""})`,
      quantity: 1,
      unitPrice: baseAmount,
      total: baseAmount,
    },
  ]

  return {
    baseAmount,
    volumeDiscount,
    volumeDiscountPercent,
    membershipDiscount,
    membershipDiscountPercent,
    subtotal,
    totalDiscount,
    totalDiscountPercent,
    finalAmount: Math.max(0, finalAmount),
    breakdown,
  }
}

/**
 * Calculate volume discount based on pallet count
 */
function calculateVolumeDiscount(
  palletCount: number,
  config: PricingConfig
): { discountPercent: number; threshold: number } {
  // Sort discounts by threshold descending to find highest applicable
  const sortedDiscounts = [...config.volumeDiscounts].sort(
    (a, b) => b.palletThreshold - a.palletThreshold
  )

  for (const discount of sortedDiscounts) {
    if (palletCount >= discount.palletThreshold) {
      return {
        discountPercent: discount.discountPercent,
        threshold: discount.palletThreshold,
      }
    }
  }

  return { discountPercent: 0, threshold: 0 }
}

/**
 * Calculate membership discount (fallback to static config)
 */
function calculateMembershipDiscount(
  tier: MembershipTier,
  config: PricingConfig
): { discountPercent: number } {
  const discount = config.membershipDiscounts.find((d) => d.tier === tier)
  return {
    discountPercent: discount?.discountPercent || 0,
  }
}

/**
 * Calculate total price with all discounts applied
 */
export async function calculateTotalPrice(
  input: PricingCalculationInput,
  config?: PricingConfig
): Promise<number> {
  if (input.type === "pallet") {
    const result = await calculatePalletPricing(input, config)
    return result.finalAmount
  } else {
    const result = await calculateAreaRentalPricing(input, config)
    return result.finalAmount
  }
}
