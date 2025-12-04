import { PRICING } from "@/lib/constants"
import type { MembershipTier, PricingConfig } from "@/types"

/**
 * Business Logic: Pricing Calculation with Discounts
 * 
 * Calculates pricing for bookings with:
 * - Volume discounts based on pallet count
 * - Membership tier discounts
 * - Combined discount application
 */

export interface PricingCalculationInput {
  type: "pallet" | "area-rental"
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

/**
 * Calculate pricing for a pallet booking
 */
export function calculatePalletPricing(
  input: PricingCalculationInput,
  config: PricingConfig = PRICING
): PricingCalculationResult {
  if (input.type !== "pallet" || !input.palletCount) {
    throw new Error("Pallet count is required for pallet bookings")
  }

  const palletCount = input.palletCount
  const months = input.months || 1
  const totalPalletCount = (input.existingPalletCount || 0) + palletCount

  // Calculate base amounts
  const palletInCost = palletCount * config.palletIn
  const storageCost = palletCount * config.storagePerPalletPerMonth * months

  const baseAmount = palletInCost + storageCost

  // Calculate volume discount
  const volumeDiscountInfo = calculateVolumeDiscount(totalPalletCount, config)
  const volumeDiscount = (baseAmount * volumeDiscountInfo.discountPercent) / 100

  // Calculate membership discount (applied after volume discount)
  const membershipDiscountInfo = calculateMembershipDiscount(
    input.membershipTier || "bronze",
    config
  )
  const amountAfterVolumeDiscount = baseAmount - volumeDiscount
  const membershipDiscount =
    (amountAfterVolumeDiscount * membershipDiscountInfo.discountPercent) / 100

  // Calculate totals
  const subtotal = baseAmount
  const totalDiscount = volumeDiscount + membershipDiscount
  const totalDiscountPercent =
    baseAmount > 0 ? (totalDiscount / baseAmount) * 100 : 0
  const finalAmount = baseAmount - totalDiscount

  // Build breakdown
  const breakdown = [
    {
      item: "Pallet In",
      quantity: palletCount,
      unitPrice: config.palletIn,
      total: palletInCost,
    },
    {
      item: `Storage (${months} month${months > 1 ? "s" : ""})`,
      quantity: palletCount,
      unitPrice: config.storagePerPalletPerMonth * months,
      total: storageCost,
    },
  ]

  return {
    baseAmount,
    volumeDiscount,
    volumeDiscountPercent: volumeDiscountInfo.discountPercent,
    membershipDiscount,
    membershipDiscountPercent: membershipDiscountInfo.discountPercent,
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
export function calculateAreaRentalPricing(
  input: PricingCalculationInput,
  config: PricingConfig = PRICING
): PricingCalculationResult {
  if (input.type !== "area-rental" || !input.areaSqFt) {
    throw new Error("Area square footage is required for area rental bookings")
  }

  if (input.areaSqFt < config.areaRentalMinSqFt) {
    throw new Error(
      `Minimum area rental is ${config.areaRentalMinSqFt} sq ft`
    )
  }

  const areaSqFt = input.areaSqFt
  const baseAmount = areaSqFt * config.areaRentalPerSqFtPerYear

  // Area rentals typically don't get volume discounts, only membership
  const volumeDiscount = 0
  const volumeDiscountPercent = 0

  // Calculate membership discount
  const membershipDiscountInfo = calculateMembershipDiscount(
    input.membershipTier || "bronze",
    config
  )
  const membershipDiscount =
    (baseAmount * membershipDiscountInfo.discountPercent) / 100

  // Calculate totals
  const subtotal = baseAmount
  const totalDiscount = membershipDiscount
  const totalDiscountPercent =
    baseAmount > 0 ? (totalDiscount / baseAmount) * 100 : 0
  const finalAmount = baseAmount - totalDiscount

  // Build breakdown
  const breakdown = [
    {
      item: "Area Rental (Annual)",
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
    membershipDiscountPercent: membershipDiscountInfo.discountPercent,
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
 * Calculate membership discount
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
export function calculateTotalPrice(
  input: PricingCalculationInput,
  config: PricingConfig = PRICING
): number {
  if (input.type === "pallet") {
    return calculatePalletPricing(input, config).finalAmount
  } else {
    return calculateAreaRentalPricing(input, config).finalAmount
  }
}

