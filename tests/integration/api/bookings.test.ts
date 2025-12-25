/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/bookings/route'
import { getBookings, createBooking } from '@/lib/db/bookings'
import { requireAuth } from '@/lib/auth/api-middleware'
import { mockBooking } from '@/tests/utils/mocks'

// Mock the database functions
jest.mock('@/lib/db/bookings')
jest.mock('@/lib/auth/api-middleware')
jest.mock('@/lib/auth/company-admin', () => ({
  isCompanyAdmin: jest.fn().mockResolvedValue(false),
  getUserCompanyId: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { name: 'Test User', email: 'test@example.com' },
        error: null,
      }),
    })),
  })),
}))

const mockGetBookings = getBookings as jest.MockedFunction<typeof getBookings>
const mockCreateBooking = createBooking as jest.MockedFunction<typeof createBooking>
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>

describe('/api/v1/bookings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Setup default auth mock
    mockRequireAuth.mockResolvedValue({
      user: { id: 'user-123', email: 'test@example.com', role: 'customer' },
    } as any)
  })

  describe('GET', () => {
    it('returns list of bookings', async () => {
      mockGetBookings.mockResolvedValue([mockBooking])

      const request = new NextRequest('http://localhost:3000/api/v1/bookings')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(mockGetBookings).toHaveBeenCalledTimes(1)
    })

    it('filters bookings by customerId', async () => {
      mockGetBookings.mockResolvedValue([mockBooking])

      const request = new NextRequest(
        'http://localhost:3000/api/v1/bookings?customerId=550e8400-e29b-41d4-a716-446655440001'
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockGetBookings).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: '550e8400-e29b-41d4-a716-446655440001' })
      )
    })

    it('filters bookings by status', async () => {
      mockGetBookings.mockResolvedValue([mockBooking])

      const request = new NextRequest(
        'http://localhost:3000/api/v1/bookings?status=pending'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockGetBookings).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      )
    })

    it('handles errors gracefully', async () => {
      mockGetBookings.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/v1/bookings')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })
  })

  describe('POST', () => {
    it('creates a new booking', async () => {
      mockCreateBooking.mockResolvedValue(mockBooking)

      const request = new NextRequest('http://localhost:3000/api/v1/bookings', {
        method: 'POST',
        body: JSON.stringify({
          type: 'pallet',
          palletCount: 50,
          startDate: '2024-01-01',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(mockCreateBooking).toHaveBeenCalledTimes(1)
    })

    it('validates required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/bookings', {
        method: 'POST',
        body: JSON.stringify({
          type: 'pallet',
          // Missing palletCount and startDate
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation error')
    })
  })
})

