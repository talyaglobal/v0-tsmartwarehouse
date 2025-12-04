import {
  calculatePalletPricing,
  calculateAreaRentalPricing,
  calculateTotalPrice,
} from '@/lib/business-logic/pricing'
import { PRICING } from '@/lib/constants'

describe('calculatePalletPricing', () => {
  it('calculates base pricing correctly', () => {
    const result = calculatePalletPricing({
      type: 'pallet',
      palletCount: 50,
      months: 1,
      membershipTier: 'bronze',
    })

    expect(result.baseAmount).toBeGreaterThan(0)
    expect(result.finalAmount).toBeGreaterThanOrEqual(0)
    expect(result.breakdown).toHaveLength(2)
    expect(result.breakdown[0].item).toBe('Pallet In')
    expect(result.breakdown[1].item).toContain('Storage')
  })

  it('applies volume discount for large pallet counts', () => {
    const result = calculatePalletPricing({
      type: 'pallet',
      palletCount: 100,
      months: 1,
      membershipTier: 'bronze',
    })

    expect(result.volumeDiscountPercent).toBeGreaterThan(0)
    expect(result.totalDiscount).toBeGreaterThan(0)
  })

  it('applies membership discount', () => {
    const bronzeResult = calculatePalletPricing({
      type: 'pallet',
      palletCount: 50,
      months: 1,
      membershipTier: 'bronze',
    })

    const goldResult = calculatePalletPricing({
      type: 'pallet',
      palletCount: 50,
      months: 1,
      membershipTier: 'gold',
    })

    expect(goldResult.membershipDiscountPercent).toBeGreaterThan(
      bronzeResult.membershipDiscountPercent
    )
  })

  it('calculates multi-month storage correctly', () => {
    const oneMonth = calculatePalletPricing({
      type: 'pallet',
      palletCount: 50,
      months: 1,
    })

    const threeMonths = calculatePalletPricing({
      type: 'pallet',
      palletCount: 50,
      months: 3,
    })

    expect(threeMonths.baseAmount).toBeGreaterThan(oneMonth.baseAmount)
  })

  it('includes existing pallet count in volume discount calculation', () => {
    const withoutExisting = calculatePalletPricing({
      type: 'pallet',
      palletCount: 50,
      existingPalletCount: 0,
    })

    const withExisting = calculatePalletPricing({
      type: 'pallet',
      palletCount: 50,
      existingPalletCount: 50,
    })

    // With existing pallets, total is 100, so should get volume discount
    expect(withExisting.volumeDiscountPercent).toBeGreaterThanOrEqual(
      withoutExisting.volumeDiscountPercent
    )
  })

  it('throws error when pallet count is missing', () => {
    expect(() => {
      calculatePalletPricing({
        type: 'pallet',
      } as any)
    }).toThrow('Pallet count is required')
  })

  it('ensures final amount is non-negative', () => {
    const result = calculatePalletPricing({
      type: 'pallet',
      palletCount: 1,
      months: 1,
    })

    expect(result.finalAmount).toBeGreaterThanOrEqual(0)
  })
})

describe('calculateAreaRentalPricing', () => {
  it('calculates area rental pricing correctly', () => {
    const result = calculateAreaRentalPricing({
      type: 'area-rental',
      areaSqFt: 40000,
      membershipTier: 'bronze',
    })

    expect(result.baseAmount).toBeGreaterThan(0)
    expect(result.finalAmount).toBeGreaterThanOrEqual(0)
    expect(result.breakdown).toHaveLength(1)
    expect(result.breakdown[0].item).toContain('Area Rental')
  })

  it('applies membership discount to area rentals', () => {
    const bronzeResult = calculateAreaRentalPricing({
      type: 'area-rental',
      areaSqFt: 40000,
      membershipTier: 'bronze',
    })

    const goldResult = calculateAreaRentalPricing({
      type: 'area-rental',
      areaSqFt: 40000,
      membershipTier: 'gold',
    })

    expect(goldResult.membershipDiscountPercent).toBeGreaterThan(
      bronzeResult.membershipDiscountPercent
    )
  })

  it('does not apply volume discount to area rentals', () => {
    const result = calculateAreaRentalPricing({
      type: 'area-rental',
      areaSqFt: 40000,
    })

    expect(result.volumeDiscount).toBe(0)
    expect(result.volumeDiscountPercent).toBe(0)
  })

  it('throws error when area is below minimum', () => {
    expect(() => {
      calculateAreaRentalPricing({
        type: 'area-rental',
        areaSqFt: 10000,
      })
    }).toThrow('Minimum area rental')
  })

  it('throws error when area sq ft is missing', () => {
    expect(() => {
      calculateAreaRentalPricing({
        type: 'area-rental',
      } as any)
    }).toThrow('Area square footage is required')
  })
})

describe('calculateTotalPrice', () => {
  it('calculates total price for pallet bookings', () => {
    const price = calculateTotalPrice({
      type: 'pallet',
      palletCount: 50,
      months: 1,
    })

    expect(price).toBeGreaterThan(0)
  })

  it('calculates total price for area rental bookings', () => {
    const price = calculateTotalPrice({
      type: 'area-rental',
      areaSqFt: 40000,
    })

    expect(price).toBeGreaterThan(0)
  })
})

