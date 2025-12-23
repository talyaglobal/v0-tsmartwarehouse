import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/tasks/route'
import { getTasks, createTask } from '@/lib/db/tasks'
import { mockTask } from '@/tests/utils/mocks'

// Mock the database functions
jest.mock('@/lib/db/tasks')

const mockGetTasks = getTasks as jest.MockedFunction<typeof getTasks>
const mockCreateTask = createTask as jest.MockedFunction<typeof createTask>

describe('/api/v1/tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('returns list of tasks', async () => {
      mockGetTasks.mockResolvedValue([mockTask])

      const request = new NextRequest('http://localhost:3000/api/v1/tasks')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(mockGetTasks).toHaveBeenCalledTimes(1)
    })

    it('filters tasks by assignedTo', async () => {
      mockGetTasks.mockResolvedValue([mockTask])

      const request = new NextRequest(
        'http://localhost:3000/api/v1/tasks?assignedTo=worker-123'
      )
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockGetTasks).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'worker-123' })
      )
    })

    it('filters tasks by status', async () => {
      mockGetTasks.mockResolvedValue([mockTask])

      const request = new NextRequest(
        'http://localhost:3000/api/v1/tasks?status=pending'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockGetTasks).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      )
    })

    it('filters tasks by priority', async () => {
      mockGetTasks.mockResolvedValue([mockTask])

      const request = new NextRequest(
        'http://localhost:3000/api/v1/tasks?priority=high'
      )
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockGetTasks).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'high' })
      )
    })

    it('handles errors gracefully', async () => {
      mockGetTasks.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/v1/tasks')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })
  })

  describe('POST', () => {
    it('creates a new task', async () => {
      mockCreateTask.mockResolvedValue(mockTask)

      const request = new NextRequest('http://localhost:3000/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({
          type: 'receiving',
          title: 'Receive shipment',
          description: 'Receive 50 pallets',
          priority: 'high',
          assignedTo: 'worker-123',
          bookingId: 'booking-123',
          warehouseId: 'wh-001',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
      expect(mockCreateTask).toHaveBeenCalledTimes(1)
    })

    it('validates required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required fields
          type: 'receiving',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Validation error')
      expect(data.details).toBeDefined()
    })

    it('sets default status to pending if not provided', async () => {
      mockCreateTask.mockResolvedValue(mockTask)

      const request = new NextRequest('http://localhost:3000/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({
          type: 'receiving',
          title: 'Receive shipment',
          description: 'Receive 50 pallets',
          priority: 'high',
          assignedTo: 'worker-123',
          bookingId: 'booking-123',
          warehouseId: 'wh-001',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      )
    })

    it('handles errors gracefully', async () => {
      mockCreateTask.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({
          type: 'receiving',
          title: 'Receive shipment',
          description: 'Receive 50 pallets',
          priority: 'high',
          assignedTo: 'worker-123',
          bookingId: 'booking-123',
          warehouseId: 'wh-001',
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

