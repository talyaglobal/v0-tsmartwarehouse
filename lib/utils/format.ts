import { PRICING } from "@/lib/constants"
import type { MembershipTier, BookingType } from "@/types"

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) {
    return "N/A"
  }
  
  const dateObj = typeof date === "string" ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) {
    return "N/A"
  }
  
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(dateObj)
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) {
    return "N/A"
  }
  
  const dateObj = typeof date === "string" ? new Date(date) : date
  
  if (isNaN(dateObj.getTime())) {
    return "N/A"
  }
  
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj)
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "0"
  // Use Turkish format with dot as thousands separator
  return new Intl.NumberFormat("tr-TR").format(num)
}

export function formatSqFt(sqFt: number): string {
  return `${formatNumber(sqFt)} sq ft`
}

// Calculate pallet storage cost
export function calculatePalletCost(
  palletCount: number,
  months = 1,
  membershipTier: MembershipTier = "bronze",
): {
  palletIn: number
  storage: number
  palletOut: number
  subtotal: number
  discount: number
  total: number
} {
  const palletIn = palletCount * PRICING.palletIn
  const storage = palletCount * PRICING.storagePerPalletPerMonth * months
  const palletOut = palletCount * PRICING.palletOut
  const subtotal = palletIn + storage + palletOut

  // Apply membership discount
  const membershipDiscount = PRICING.membershipDiscounts.find((d) => d.tier === membershipTier)?.discountPercent || 0

  // Apply volume discount
  let volumeDiscount = 0
  for (const vd of PRICING.volumeDiscounts) {
    if (palletCount >= vd.palletThreshold) {
      volumeDiscount = vd.discountPercent
    }
  }

  const totalDiscount = Math.max(membershipDiscount, volumeDiscount)
  const discount = subtotal * (totalDiscount / 100)
  const total = subtotal - discount

  return { palletIn, storage, palletOut, subtotal, discount, total }
}

// Calculate area rental cost
export function calculateAreaRentalCost(
  sqFt: number,
  membershipTier: MembershipTier = "bronze",
): {
  annualCost: number
  monthlyCost: number
  discount: number
  total: number
  isValid: boolean
  error?: string
} {
  // Validate minimum sq ft requirement
  if (sqFt < PRICING.areaRentalMinSqFt) {
    return {
      annualCost: 0,
      monthlyCost: 0,
      discount: 0,
      total: 0,
      isValid: false,
      error: `Minimum area rental is ${formatNumber(PRICING.areaRentalMinSqFt)} sq ft`,
    }
  }

  const annualCost = sqFt * PRICING.areaRentalPerSqFtPerYear
  const monthlyCost = annualCost / 12

  // Apply membership discount
  const membershipDiscount = PRICING.membershipDiscounts.find((d) => d.tier === membershipTier)?.discountPercent || 0
  const discount = annualCost * (membershipDiscount / 100)
  const total = annualCost - discount

  return { annualCost, monthlyCost, discount, total, isValid: true }
}

// Get booking type label
export function getBookingTypeLabel(type: BookingType): string {
  switch (type) {
    case "pallet":
      return "Pallet Storage"
    case "area-rental":
      return "Space Storage"
    default:
      return type
  }
}

