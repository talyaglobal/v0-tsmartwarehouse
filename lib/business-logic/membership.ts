import { getMembershipProgramStatus, getMembershipSettingByTier, calculateMembershipTierFromSpend as dbCalculateMembershipTierFromSpend } from "@/lib/db/membership"
import type { MembershipTier } from "@/types"

/**
 * Business Logic: Membership Tier Calculation
 * 
 * Determines membership tier based on:
 * - Total spend (paid invoices) - PRIMARY METHOD
 * - Database-driven tier thresholds and discounts
 * - Program can be enabled/disabled by root users
 */

export interface MembershipTierInfo {
  tier: MembershipTier
  name: string
  minSpend: number // Changed from minPallets to minSpend
  discount: number
  benefits: string[]
  nextTier?: {
    tier: MembershipTier
    name: string
    minSpend: number
    spendNeeded: number // Changed from palletsNeeded to spendNeeded
  }
}

/**
 * Calculate membership tier based on total spend (paid invoices)
 * Uses database-driven tier thresholds
 */
export async function calculateMembershipTierFromSpend(
  totalSpend: number
): Promise<MembershipTier> {
  return await dbCalculateMembershipTierFromSpend(totalSpend)
}

/**
 * Get membership tier information with next tier details (based on spend)
 */
export async function getMembershipTierInfoFromSpend(
  totalSpend: number
): Promise<MembershipTierInfo> {
  const currentTier = await calculateMembershipTierFromSpend(totalSpend)
  const currentSetting = await getMembershipSettingByTier(currentTier)

  if (!currentSetting) {
    // Fallback to bronze if no setting found
    return {
      tier: 'bronze',
      name: 'Bronze',
      minSpend: 0,
      discount: 0,
      benefits: [],
    }
  }

  // Find next tier
  const tierOrder: MembershipTier[] = ["bronze", "silver", "gold", "platinum"]
  const currentIndex = tierOrder.indexOf(currentTier)
  const nextTier =
    currentIndex < tierOrder.length - 1
      ? tierOrder[currentIndex + 1]
      : undefined

  let nextTierInfo: MembershipTierInfo["nextTier"] | undefined

  if (nextTier) {
    const nextSetting = await getMembershipSettingByTier(nextTier)
    if (nextSetting) {
      const spendNeeded = Math.max(0, nextSetting.minSpend - totalSpend)

      nextTierInfo = {
        tier: nextTier,
        name: nextSetting.tierName.charAt(0).toUpperCase() + nextSetting.tierName.slice(1),
        minSpend: nextSetting.minSpend,
        spendNeeded,
      }
    }
  }

  return {
    tier: currentTier,
    name: currentSetting.tierName.charAt(0).toUpperCase() + currentSetting.tierName.slice(1),
    minSpend: currentSetting.minSpend,
    discount: currentSetting.discountPercent,
    benefits: currentSetting.benefits,
    nextTier: nextTierInfo,
  }
}

/**
 * Check if customer qualifies for tier upgrade (based on new total spend)
 */
export async function checkTierUpgradeFromSpend(
  currentTier: MembershipTier,
  newTotalSpend: number
): Promise<{
  upgraded: boolean
  newTier: MembershipTier
  previousTier: MembershipTier
}> {
  const newTier = await calculateMembershipTierFromSpend(newTotalSpend)

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
 * Get membership tier discount from database
 */
export async function getMembershipTierDiscount(tier: MembershipTier): Promise<number> {
  const setting = await getMembershipSettingByTier(tier)
  return setting?.discountPercent || 0
}

/**
 * Check if membership program is enabled
 */
export async function isMembershipProgramEnabled(): Promise<boolean> {
  const programStatus = await getMembershipProgramStatus()
  return programStatus.programEnabled
}


