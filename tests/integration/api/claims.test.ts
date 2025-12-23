import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/claims/route'
import { getClaims, createClaim } from '@/lib/db/claims'
import { requireAuth } from '@/lib/auth/api-middleware'
import { mockUser } from '@/tests/utils/mocks'

// Mock the database functions
jest.mock('@/lib/db/claims')
jest.mock('@/lib/auth/api-middleware')
jest.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { name: 'Test User', email: 'test@example.com' },
        error: null,
      }),
    })),
  })),
}))

const mockGetClaims = getClaims as jest.MockedFunction<typeof getClaims>
const mockCreateClaim = createClaim as jest.MockedFunction<typeof createClaim>
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>

const mockClaim = {
  id: 'claim-123',
  customerId: 'user-123',
  customerName: 'Test User',
  bookingId: 'booking-123',
  incidentId: null,
  type: 'damage',
  description: 'Test claim',
  amount: 1000,
  status: 'submitted',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('/api/v1/claims', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('returns list of claims', async () => {
      mockGetClaims.mockResolvedValue([mockClaim])

      const request = new NextRequest('http://localhost:3000/api/v1/claims')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(mockGetClaims).toHaveBeenCalledTimes(1)
    })

    it('filters claims by customerId', async () => {
      mockGetClaims.mockResolvedValue([mockClaim])

      const request = new NextRequest(
        'http://localhost:3000/api/v1/claims?customerId=user-123'
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockGetClaims).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'user-123' })
      )
    })

    it('filters claims by status', async () => {
      mockGetClaims.mockResolvedValue([mockClaim])

      const request = new NextRequest(
        'http://localhost:3000/api/v1/claims?status=submitted'
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockGetClaims).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'submitted' })
      )
    })

    it('handles errors gracefully', async () => {
      mockGetClaims.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/v1/claims')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })
  })

  describe('POST', () => {
    it('creates a new claim', async () => {
      mockRequireAuth.mockResolvedValue({
        user: mockUser,
      } as any)
      mockCreateClaim.mockResolvedValue(mockClaim)

      const request = new NextRequest('http://localhost:3000/api/v1/claims', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: 'booking-123',
          description: 'Test claim',
          amount: 1000,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(mockCreateClaim).toHaveBeenCalledTimes(1)
    })

    it('requires authentication', async () => {
      const { NextResponse } = await import('next/server')
      mockRequireAuth.mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as any
      )

      const request = new NextRequest('http://localhost:3000/api/v1/claims', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: 'booking-123',
          description: 'Test claim',
          amount: 1000,
        }),
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('validates required fields', async () => {
      mockRequireAuth.mockResolvedValue({
        user: mockUser,
      } as any)

      const request = new NextRequest('http://localhost:3000/api/v1/claims', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required fields
          description: 'Test claim',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation error')
      expect(data.details).toBeDefined()
    })

    it('sets default status to submitted if not provided', async () => {
      mockRequireAuth.mockResolvedValue({
        user: mockUser,
      } as any)
      mockCreateClaim.mockResolvedValue(mockClaim)

      const request = new NextRequest('http://localhost:3000/api/v1/claims', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: 'booking-123',
          description: 'Test claim',
          amount: 1000,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockCreateClaim).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'submitted' })
      )
    })

    it('handles errors gracefully', async () => {
      mockRequireAuth.mockResolvedValue({
        user: mockUser,
      } as any)
      mockCreateClaim.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/v1/claims', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: 'booking-123',
          description: 'Test claim',
          amount: 1000,
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })
  })
})

