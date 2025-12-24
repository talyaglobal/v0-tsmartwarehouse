import type { User, Booking, Task, Invoice } from '@/types'

// Mock user data
export const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'customer',
  companyName: 'Test Company',
  phone: '+1234567890',
  avatar: undefined,
  membershipTier: 'bronze',
  creditBalance: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export const mockAdminUser: User = {
  ...mockUser,
  id: 'admin-123',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
}

export const mockWorkerUser: User = {
  ...mockUser,
  id: 'worker-123',
  email: 'worker@example.com',
  name: 'Worker User',
  role: 'worker',
}

// Mock booking data
export const mockBooking: Booking = {
  id: 'booking-123',
  customerId: 'user-123',
  customerName: 'Test User',
  customerEmail: 'test@example.com',
  warehouseId: 'wh-001',
  type: 'pallet',
  status: 'pending',
  palletCount: 50,
  areaSqFt: undefined,
  floorNumber: undefined,
  hallId: undefined,
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  totalAmount: 875.0,
  notes: 'Test booking',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// Mock task data
export const mockTask: Task = {
  id: 'task-123',
  type: 'receiving',
  title: 'Receive shipment',
  description: 'Receive 50 pallets',
  status: 'pending',
  priority: 'high',
  assignedTo: 'worker-123',
  assignedToName: 'Worker User',
  bookingId: 'booking-123',
  warehouseId: 'wh-001',
  zone: 'A1',
  location: 'Floor 1, Hall A',
  dueDate: new Date().toISOString(),
  completedAt: undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// Mock invoice data
export const mockInvoice: Invoice = {
  id: 'invoice-123',
  bookingId: 'booking-123',
  customerId: 'user-123',
  customerName: 'Test User',
  status: 'pending',
  items: [
    {
      description: 'Pallet storage',
      quantity: 50,
      unitPrice: 17.5,
      total: 875.0,
    },
  ],
  subtotal: 875.0,
  tax: 87.5,
  total: 962.5,
  dueDate: '2024-12-31',
  paidDate: undefined,
  createdAt: new Date().toISOString(),
}

// Mock API responses
export const mockApiResponse = <T>(data: T) => ({
  success: true,
  data,
  total: Array.isArray(data) ? data.length : 1,
})

export const mockApiError = (message: string, statusCode = 400) => ({
  success: false,
  error: message,
  statusCode,
})

