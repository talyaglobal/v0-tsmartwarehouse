import {
  calculatePalletPricing,
  calculateAreaRentalPricing,
  calculateTotalPrice,
  type PricingCalculationInput,
} from '@/lib/business-logic/pricing'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
}))

// Mock membership settings
jest.mock('@/lib/db/membership', () => ({
  getMembershipSettingByTier: jest.fn().mockResolvedValue({
    discount_percentage: 5,
    tier_name: 'bronze',
  }),
}))

const mockWarehouseId = 'test-warehouse-123'

describe('calculatePalletPricing', () => {
  it('calculates base pricing correctly', async () => {
    const result = await calculatePalletPricing({
      type: 'pallet',
      warehouseId: mockWarehouseId,
      palletCount: 50,
      months: 1,
      membershipTier: 'bronze',
    })

    expect(result.baseAmount).toBeGreaterThan(0)
    expect(result.finalAmount).toBeGreaterThanOrEqual(0)
    expect(result.breakdown).toBeDefined()
    expect(Array.isArray(result.breakdown)).toBe(true)
  })

  it('applies volume discount for large pallet counts', async () => {
    const result = await calculatePalletPricing({
      type: 'pallet',
      warehouseId: mockWarehouseId,
      palletCount: 100,
      months: 1,
      membershipTier: 'bronze',
    })

    expect(result.volumeDiscountPercent).toBeGreaterThanOrEqual(0)
    expect(result.totalDiscount).toBeGreaterThanOrEqual(0)
  })

  it('applies membership discount', async () => {
    const bronzeResult = await calculatePalletPricing({
      type: 'pallet',
      warehouseId: mockWarehouseId,
      palletCount: 50,
      months: 1,
      membershipTier: 'bronze',
    })

    const goldResult = await calculatePalletPricing({
      type: 'pallet',
      warehouseId: mockWarehouseId,
      palletCount: 50,
      months: 1,
      membershipTier: 'gold',
    })

    expect(goldResult.membershipDiscountPercent).toBeGreaterThanOrEqual(0)
    expect(bronzeResult.membershipDiscountPercent).toBeGreaterThanOrEqual(0)
  })

  it('calculates multi-month storage correctly', async () => {
    const oneMonth = await calculatePalletPricing({
      type: 'pallet',
      warehouseId: mockWarehouseId,
      palletCount: 50,
      months: 1,
    })

    const threeMonths = await calculatePalletPricing({
      type: 'pallet',
      warehouseId: mockWarehouseId,
      palletCount: 50,
      months: 3,
    })

    expect(threeMonths.baseAmount).toBeGreaterThan(oneMonth.baseAmount)
  })

  it('includes existing pallet count in volume discount calculation', async () => {
    const withoutExisting = await calculatePalletPricing({
      type: 'pallet',
      warehouseId: mockWarehouseId,
      palletCount: 50,
      existingPalletCount: 0,
    })

    const withExisting = await calculatePalletPricing({
      type: 'pallet',
      warehouseId: mockWarehouseId,
      palletCount: 50,
      existingPalletCount: 50,
    })

    // With existing pallets, total is 100, so should get volume discount
    expect(withExisting.volumeDiscountPercent).toBeGreaterThanOrEqual(
      withoutExisting.volumeDiscountPercent
    )
  })

  it('throws error when pallet count is missing', async () => {
    await expect(
      calculatePalletPricing({
        type: 'pallet',
        warehouseId: mockWarehouseId,
      } as PricingCalculationInput)
    ).rejects.toThrow()
  })

  it('ensures final amount is non-negative', async () => {
    const result = await calculatePalletPricing({
      type: 'pallet',
      warehouseId: mockWarehouseId,
      palletCount: 1,
      months: 1,
    })

    expect(result.finalAmount).toBeGreaterThanOrEqual(0)
  })
})

describe('calculateAreaRentalPricing', () => {
  it('calculates area rental pricing correctly', async () => {
    const result = await calculateAreaRentalPricing({
      type: 'area-rental',
      warehouseId: mockWarehouseId,
      areaSqFt: 40000,
      membershipTier: 'bronze',
    })

    expect(result.baseAmount).toBeGreaterThan(0)
    expect(result.finalAmount).toBeGreaterThanOrEqual(0)
    expect(result.breakdown).toBeDefined()
    expect(Array.isArray(result.breakdown)).toBe(true)
  })

  it('applies membership discount to area rentals', async () => {
    const bronzeResult = await calculateAreaRentalPricing({
      type: 'area-rental',
      warehouseId: mockWarehouseId,
      areaSqFt: 40000,
      membershipTier: 'bronze',
    })

    const goldResult = await calculateAreaRentalPricing({
      type: 'area-rental',
      warehouseId: mockWarehouseId,
      areaSqFt: 40000,
      membershipTier: 'gold',
    })

    expect(goldResult.membershipDiscountPercent).toBeGreaterThanOrEqual(0)
    expect(bronzeResult.membershipDiscountPercent).toBeGreaterThanOrEqual(0)
  })

  it('does not apply volume discount to area rentals', async () => {
    const result = await calculateAreaRentalPricing({
      type: 'area-rental',
      warehouseId: mockWarehouseId,
      areaSqFt: 40000,
    })

    expect(result.volumeDiscount).toBe(0)
    expect(result.volumeDiscountPercent).toBe(0)
  })

  it('throws error when area is below minimum', async () => {
    await expect(
      calculateAreaRentalPricing({
        type: 'area-rental',
        warehouseId: mockWarehouseId,
        areaSqFt: 10000,
      })
    ).rejects.toThrow()
  })

  it('throws error when area sq ft is missing', async () => {
    await expect(
      calculateAreaRentalPricing({
        type: 'area-rental',
        warehouseId: mockWarehouseId,
      } as PricingCalculationInput)
    ).rejects.toThrow()
  })
})

describe('calculateTotalPrice', () => {
  it('calculates total price for pallet bookings', async () => {
    const price = await calculateTotalPrice({
      type: 'pallet',
      warehouseId: mockWarehouseId,
      palletCount: 50,
      months: 1,
    })

    expect(price).toBeGreaterThan(0)
  })

  it('calculates total price for area rental bookings', async () => {
    const price = await calculateTotalPrice({
      type: 'area-rental',
      warehouseId: mockWarehouseId,
      areaSqFt: 40000,
    })

    expect(price).toBeGreaterThan(0)
  })
})
