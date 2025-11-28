import type { MembershipBenefit, MembershipTier } from "../types"

const membershipBenefits: MembershipBenefit[] = [
  {
    tier: "bronze",
    discount_percentage: 0,
    free_storage_days: 0,
    priority_support: false,
    dedicated_account_manager: false,
    insurance_coverage: 10000,
    min_spend: 0,
  },
  {
    tier: "silver",
    discount_percentage: 5,
    free_storage_days: 7,
    priority_support: true,
    dedicated_account_manager: false,
    insurance_coverage: 25000,
    min_spend: 25000,
  },
  {
    tier: "gold",
    discount_percentage: 10,
    free_storage_days: 14,
    priority_support: true,
    dedicated_account_manager: true,
    insurance_coverage: 50000,
    min_spend: 75000,
  },
  {
    tier: "platinum",
    discount_percentage: 15,
    free_storage_days: 30,
    priority_support: true,
    dedicated_account_manager: true,
    insurance_coverage: 100000,
    min_spend: 150000,
  },
]

export class MembershipService {
  private static instance: MembershipService

  static getInstance(): MembershipService {
    if (!MembershipService.instance) {
      MembershipService.instance = new MembershipService()
    }
    return MembershipService.instance
  }

  getBenefits(tier: MembershipTier): MembershipBenefit | undefined {
    return membershipBenefits.find((b) => b.tier === tier)
  }

  getAllBenefits(): MembershipBenefit[] {
    return membershipBenefits
  }

  calculateTierFromSpend(totalSpend: number): MembershipTier {
    const sortedBenefits = [...membershipBenefits].sort((a, b) => b.min_spend - a.min_spend)
    for (const benefit of sortedBenefits) {
      if (totalSpend >= benefit.min_spend) {
        return benefit.tier
      }
    }
    return "bronze"
  }

  getDiscount(tier: MembershipTier): number {
    return this.getBenefits(tier)?.discount_percentage ?? 0
  }

  canUpgrade(currentTier: MembershipTier, totalSpend: number): MembershipTier | null {
    const tiers: MembershipTier[] = ["bronze", "silver", "gold", "platinum"]
    const currentIndex = tiers.indexOf(currentTier)
    const calculatedTier = this.calculateTierFromSpend(totalSpend)
    const calculatedIndex = tiers.indexOf(calculatedTier)

    if (calculatedIndex > currentIndex) {
      return calculatedTier
    }
    return null
  }

  getNextTier(currentTier: MembershipTier): MembershipTier | null {
    const tiers: MembershipTier[] = ["bronze", "silver", "gold", "platinum"]
    const currentIndex = tiers.indexOf(currentTier)
    if (currentIndex < tiers.length - 1) {
      return tiers[currentIndex + 1]
    }
    return null
  }

  getSpendToNextTier(currentTier: MembershipTier, currentSpend: number): number {
    const nextTier = this.getNextTier(currentTier)
    if (!nextTier) return 0
    const nextBenefit = this.getBenefits(nextTier)
    if (!nextBenefit) return 0
    return Math.max(0, nextBenefit.min_spend - currentSpend)
  }
}

export const membershipService = MembershipService.getInstance()
