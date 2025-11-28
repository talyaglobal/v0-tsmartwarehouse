import type { Booking } from "../types"

export interface PricingTier {
  id: string
  name: string
  min_sqft: number
  max_sqft: number
  base_rate: number
  rate_per_sqft: number
}

export interface PricingCalculation {
  base_cost: number
  storage_cost: number
  handling_cost: number
  value_added_cost: number
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  breakdown: PricingLineItem[]
}

export interface PricingLineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}

const pricingTiers: PricingTier[] = [
  { id: "tier-1", name: "Small", min_sqft: 0, max_sqft: 100, base_rate: 200, rate_per_sqft: 0.95 },
  { id: "tier-2", name: "Medium", min_sqft: 101, max_sqft: 500, base_rate: 150, rate_per_sqft: 0.85 },
  { id: "tier-3", name: "Large", min_sqft: 501, max_sqft: 2000, base_rate: 100, rate_per_sqft: 0.75 },
  {
    id: "tier-4",
    name: "Enterprise",
    min_sqft: 2001,
    max_sqft: Number.POSITIVE_INFINITY,
    base_rate: 50,
    rate_per_sqft: 0.65,
  },
]

export class PricingService {
  private static instance: PricingService
  private taxRate = 0.08 // 8% tax

  static getInstance(): PricingService {
    if (!PricingService.instance) {
      PricingService.instance = new PricingService()
    }
    return PricingService.instance
  }

  getTier(sqft: number): PricingTier {
    return pricingTiers.find((t) => sqft >= t.min_sqft && sqft <= t.max_sqft) ?? pricingTiers[0]
  }

  calculateStorageCost(sqft: number, months: number): number {
    const tier = this.getTier(sqft)
    return (tier.base_rate + sqft * tier.rate_per_sqft) * months
  }

  calculateBookingPrice(
    serviceType: Booking["service_type"],
    sqft: number,
    durationDays: number,
    itemCount: number,
    discountPercent = 0,
  ): PricingCalculation {
    const breakdown: PricingLineItem[] = []
    let subtotal = 0

    // Base storage cost
    const months = Math.ceil(durationDays / 30)
    const storageCost = this.calculateStorageCost(sqft, months)
    breakdown.push({
      description: `Storage (${months} month${months > 1 ? "s" : ""})`,
      quantity: months,
      unit_price: storageCost / months,
      total: storageCost,
    })
    subtotal += storageCost

    // Handling costs based on service type
    let handlingCost = 0
    if (serviceType === "fulfillment") {
      handlingCost = itemCount * 2.5
      breakdown.push({
        description: "Pick & Pack",
        quantity: itemCount,
        unit_price: 2.5,
        total: handlingCost,
      })
    } else if (serviceType === "cross_dock") {
      handlingCost = itemCount * 1.5
      breakdown.push({
        description: "Cross-Dock Handling",
        quantity: itemCount,
        unit_price: 1.5,
        total: handlingCost,
      })
    }
    subtotal += handlingCost

    // Value-added services
    let valueAddedCost = 0
    if (serviceType === "value_added") {
      valueAddedCost = itemCount * 5
      breakdown.push({
        description: "Value-Added Services",
        quantity: itemCount,
        unit_price: 5,
        total: valueAddedCost,
      })
    }
    subtotal += valueAddedCost

    // Discount
    const discountAmount = subtotal * (discountPercent / 100)

    // Tax
    const taxableAmount = subtotal - discountAmount
    const taxAmount = taxableAmount * this.taxRate

    return {
      base_cost: storageCost,
      storage_cost: storageCost,
      handling_cost: handlingCost,
      value_added_cost: valueAddedCost,
      subtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total: taxableAmount + taxAmount,
      breakdown,
    }
  }

  getDepositAmount(total: number, percentage = 20): number {
    return total * (percentage / 100)
  }
}

export const pricingService = PricingService.getInstance()
