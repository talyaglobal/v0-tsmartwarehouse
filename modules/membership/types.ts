import type { MembershipTier } from "../common/types"

export interface MembershipBenefit {
  tier: MembershipTier
  discount_percentage: number
  free_storage_days: number
  priority_support: boolean
  dedicated_account_manager: boolean
  insurance_coverage: number
  min_spend: number
}

export interface MembershipCredit {
  id: string
  customer_id: string
  amount: number
  type: "earned" | "redeemed" | "expired" | "bonus"
  description: string
  expires_at?: string
  created_at: string
}

export interface MembershipUpgradeRequest {
  customer_id: string
  target_tier: MembershipTier
}

export interface CreditRedemptionRequest {
  customer_id: string
  amount: number
  booking_id?: string
}
