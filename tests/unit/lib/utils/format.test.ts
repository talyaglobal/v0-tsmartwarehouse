import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatSqFt,
  calculatePalletCost,
  calculateAreaRentalCost,
  getBookingTypeLabel,
} from '@/lib/utils/format'

describe('formatCurrency', () => {
  it('formats positive numbers correctly', () => {
    expect(formatCurrency(100)).toBe('$100.00')
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats negative numbers correctly', () => {
    expect(formatCurrency(-100)).toBe('-$100.00')
  })
})

describe('formatDate', () => {
  it('formats date strings correctly', () => {
    const date = '2024-01-15T12:00:00.000Z'
    const formatted = formatDate(date)
    expect(formatted).toMatch(/Jan (14|15), 2024/)
  })

  it('formats Date objects correctly', () => {
    const date = new Date('2024-01-15T12:00:00.000Z')
    const formatted = formatDate(date)
    expect(formatted).toMatch(/Jan (14|15), 2024/)
  })
})

describe('formatDateTime', () => {
  it('formats datetime strings correctly', () => {
    const datetime = '2024-01-15T14:30:00Z'
    const formatted = formatDateTime(datetime)
    expect(formatted).toMatch(/Jan 15, 2024/)
    // Check that time is included (format may vary by locale)
    expect(formatted.length).toBeGreaterThan(10)
  })
})

describe('formatNumber', () => {
  it('formats numbers with commas', () => {
    expect(formatNumber(1000)).toBe('1,000')
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('formats small numbers without commas', () => {
    expect(formatNumber(100)).toBe('100')
  })
})

describe('formatSqFt', () => {
  it('formats square footage correctly', () => {
    expect(formatSqFt(1000)).toBe('1,000 sq ft')
    expect(formatSqFt(40000)).toBe('40,000 sq ft')
  })
})

describe('calculatePalletCost', () => {
  it('calculates cost for bronze tier correctly', () => {
    const result = calculatePalletCost(50, 1, 'bronze')
    expect(result.palletIn).toBe(250) // 50 * $5
    expect(result.storage).toBe(875) // 50 * $17.50
    expect(result.palletOut).toBe(250) // 50 * $5
    expect(result.subtotal).toBe(1375)
    // 50 pallets triggers volume discount (10%), so discount is applied
    expect(result.discount).toBeGreaterThan(0)
    expect(result.total).toBeLessThan(result.subtotal)
  })

  it('applies membership discount correctly', () => {
    const result = calculatePalletCost(50, 1, 'silver')
    expect(result.subtotal).toBe(1375)
    expect(result.discount).toBeGreaterThan(0) // 5% discount
  })

  it('applies volume discount correctly', () => {
    const result = calculatePalletCost(100, 1, 'bronze')
    expect(result.discount).toBeGreaterThan(0) // Volume discount kicks in
  })

  it('calculates multi-month storage correctly', () => {
    const result = calculatePalletCost(50, 3, 'bronze')
    expect(result.storage).toBe(2625) // 50 * $17.50 * 3
  })
})

describe('calculateAreaRentalCost', () => {
  it('calculates cost for valid area rental', () => {
    const result = calculateAreaRentalCost(40000, 'bronze')
    expect(result.isValid).toBe(true)
    expect(result.annualCost).toBe(800000) // 40000 * $20
    expect(result.monthlyCost).toBeCloseTo(66666.67, 2) // 800000 / 12
    expect(result.total).toBe(800000)
  })

  it('rejects area below minimum', () => {
    const result = calculateAreaRentalCost(10000, 'bronze')
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('Minimum area rental')
  })

  it('applies membership discount correctly', () => {
    const result = calculateAreaRentalCost(40000, 'gold')
    expect(result.isValid).toBe(true)
    expect(result.discount).toBeGreaterThan(0) // 10% discount
  })
})

describe('getBookingTypeLabel', () => {
  it('returns correct label for pallet', () => {
    expect(getBookingTypeLabel('pallet')).toBe('Pallet Storage')
  })

  it('returns correct label for area-rental', () => {
    expect(getBookingTypeLabel('area-rental')).toBe('Area Rental')
  })
})

