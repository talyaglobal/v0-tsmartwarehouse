import { MEMBERSHIP_BENEFITS } from "@/lib/constants"
import type { MembershipTier } from "@/types"

/**
 * Business Logic: Membership Tier Calculation
 * 
 * Determines membership tier based on:
 * - Total pallet count (active bookings)
 * - Historical pallet volume
 * - Account age/tenure (optional)
 */

export interface MembershipCalculationInput {
  currentPalletCount: number // Active pallets in storage
  historicalPalletCount?: number // Total pallets ever stored
  accountAgeMonths?: number // Account tenure in months
}

export interface MembershipTierInfo {
  tier: MembershipTier
  name: string
  minPallets: number
  discount: number
  benefits: string[]
  nextTier?: {
    tier: MembershipTier
    name: string
    minPallets: number
    palletsNeeded: number
  }
}

/**
 * Calculate membership tier based on pallet count
 * Uses the highest tier threshold that the customer meets
 */
export function calculateMembershipTier(
  input: MembershipCalculationInput
): MembershipTier {
  const palletCount = input.currentPalletCount

  // Check tiers in descending order (highest first)
  const tierOrder: MembershipTier[] = ["platinum", "gold", "silver", "bronze"]

  for (const tier of tierOrder) {
    const benefits = MEMBERSHIP_BENEFITS[tier]
    if (palletCount >= benefits.minPallets) {
      return tier
    }
  }

  // Default to bronze if no threshold met
  return "bronze"
}

/**
 * Get membership tier information with next tier details
 */
export function getMembershipTierInfo(
  input: MembershipCalculationInput
): MembershipTierInfo {
  const currentTier = calculateMembershipTier(input)
  const currentBenefits = MEMBERSHIP_BENEFITS[currentTier]

  // Find next tier
  const tierOrder: MembershipTier[] = ["bronze", "silver", "gold", "platinum"]
  const currentIndex = tierOrder.indexOf(currentTier)
  const nextTier =
    currentIndex < tierOrder.length - 1
      ? tierOrder[currentIndex + 1]
      : undefined

  let nextTierInfo: MembershipTierInfo["nextTier"] | undefined

  if (nextTier) {
    const nextBenefits = MEMBERSHIP_BENEFITS[nextTier]
    const palletsNeeded = Math.max(
      0,
      nextBenefits.minPallets - input.currentPalletCount
    )

    nextTierInfo = {
      tier: nextTier,
      name: nextBenefits.name,
      minPallets: nextBenefits.minPallets,
      palletsNeeded,
    }
  }

  return {
    tier: currentTier,
    name: currentBenefits.name,
    minPallets: currentBenefits.minPallets,
    discount: currentBenefits.discount,
    benefits: currentBenefits.benefits,
    nextTier: nextTierInfo,
  }
}

/**
 * Check if customer qualifies for tier upgrade
 */
export function checkTierUpgrade(
  currentTier: MembershipTier,
  newPalletCount: number
): {
  upgraded: boolean
  newTier: MembershipTier
  previousTier: MembershipTier
} {
  const newTier = calculateMembershipTier({
    currentPalletCount: newPalletCount,
  })

  return {
    upgraded: newTier !== currentTier && tierLevel(newTier) > tierLevel(currentTier),
    newTier,
    previousTier: currentTier,
  }
}

/**
 * Get tier level for comparison (higher number = better tier)
 */
function tierLevel(tier: MembershipTier): number {
  const levels: Record<MembershipTier, number> = {
    bronze: 1,
    silver: 2,
    gold: 3,
    platinum: 4,
  }
  return levels[tier]
}

/**
 * Calculate membership tier from database pallet count
 * This would typically be called with data from active bookings
 */
export async function calculateMembershipTierFromBookings(
  customerId: string,
  getActivePalletCount: (customerId: string) => Promise<number>
): Promise<MembershipTier> {
  const palletCount = await getActivePalletCount(customerId)
  return calculateMembershipTier({ currentPalletCount: palletCount })
}

