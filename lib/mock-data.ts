import type { Booking, User, Task, Invoice, Incident, Claim, Notification, WorkerShift, DashboardStats } from "@/types"

// Mock Users
export const mockUsers: User[] = [
  {
    id: "user-1",
    email: "admin@tsmart.com",
    name: "John Admin",
    role: "root",
    phone: "+1 555-0100",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-2",
    email: "customer@example.com",
    name: "Sarah Johnson",
    role: "warehouse_client",
    companyName: "Acme Corp",
    phone: "+1 555-0101",
    membershipTier: "gold",
    creditBalance: 2500,
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-06-01T00:00:00Z",
  },
  {
    id: "user-3",
    email: "worker@tsmart.com",
    name: "Mike Worker",
    role: "warehouse_staff",
    phone: "+1 555-0102",
    createdAt: "2024-02-01T00:00:00Z",
    updatedAt: "2024-02-01T00:00:00Z",
  },
]

// Mock Bookings
export const mockBookings: Booking[] = [
  {
    id: "book-001",
    customerId: "user-2",
    customerName: "Sarah Johnson",
    customerEmail: "customer@example.com",
    warehouseId: "wh-001",
    type: "pallet",
    status: "active",
    palletCount: 75,
    startDate: "2024-06-01",
    totalAmount: 1687.5,
    notes: "Electronics storage - handle with care",
    createdAt: "2024-05-28T10:00:00Z",
    updatedAt: "2024-06-01T08:00:00Z",
  },
  {
    id: "book-002",
    customerId: "user-4",
    customerName: "Tech Solutions Inc",
    customerEmail: "warehouse@techsolutions.com",
    warehouseId: "wh-001",
    type: "area-rental",
    status: "confirmed",
    areaSqFt: 40000,
    floorNumber: 3,
    hallId: "floor-3-hall-a",
    startDate: "2024-07-01",
    endDate: "2025-06-30",
    totalAmount: 480000,
    notes: "Annual area rental - Level 3 Hall A",
    createdAt: "2024-06-15T14:00:00Z",
    updatedAt: "2024-06-15T14:00:00Z",
  },
  {
    id: "book-003",
    customerId: "user-5",
    customerName: "Global Imports LLC",
    customerEmail: "ops@globalimports.com",
    warehouseId: "wh-001",
    type: "pallet",
    status: "pending",
    palletCount: 120,
    startDate: "2024-07-15",
    totalAmount: 2730.0,
    createdAt: "2024-06-20T09:00:00Z",
    updatedAt: "2024-06-20T09:00:00Z",
  },
]

// Mock Tasks
export const mockTasks: Task[] = [
  {
    id: "task-001",
    type: "receiving",
    title: "Receive shipment from Acme Corp",
    description: "75 pallets of electronics - verify count and condition",
    status: "pending",
    priority: "high",
    assignedTo: "user-3",
    assignedToName: "Mike Worker",
    bookingId: "book-001",
    warehouseId: "wh-001",
    zone: "Receiving",
    location: "Dock 3",
    dueDate: "2024-06-25T14:00:00Z",
    createdAt: "2024-06-24T08:00:00Z",
    updatedAt: "2024-06-24T08:00:00Z",
  },
  {
    id: "task-002",
    type: "putaway",
    title: "Store pallets in Zone A2",
    description: "Move received pallets to designated storage area",
    status: "assigned",
    priority: "medium",
    assignedTo: "user-3",
    assignedToName: "Mike Worker",
    bookingId: "book-001",
    warehouseId: "wh-001",
    zone: "Storage A",
    location: "A2-01 through A2-75",
    dueDate: "2024-06-25T18:00:00Z",
    createdAt: "2024-06-24T08:00:00Z",
    updatedAt: "2024-06-24T08:00:00Z",
  },
  {
    id: "task-003",
    type: "inventory-check",
    title: "Weekly inventory audit - Cold Storage",
    description: "Verify inventory counts in cold storage zone",
    status: "in-progress",
    priority: "medium",
    assignedTo: "user-6",
    assignedToName: "Lisa Chen",
    warehouseId: "wh-001",
    zone: "Cold Storage",
    dueDate: "2024-06-26T12:00:00Z",
    createdAt: "2024-06-24T06:00:00Z",
    updatedAt: "2024-06-25T09:00:00Z",
  },
]

// Mock Invoices
export const mockInvoices: Invoice[] = [
  {
    id: "inv-001",
    bookingId: "book-001",
    customerId: "user-2",
    customerName: "Sarah Johnson",
    status: "paid",
    items: [
      { description: "Pallet In (75 pallets)", quantity: 75, unitPrice: 5.0, total: 375.0 },
      { description: "Monthly Storage (75 pallets)", quantity: 75, unitPrice: 17.5, total: 1312.5 },
    ],
    subtotal: 1687.5,
    tax: 135.0,
    total: 1822.5,
    dueDate: "2024-06-15",
    paidDate: "2024-06-10",
    createdAt: "2024-06-01T00:00:00Z",
  },
  {
    id: "inv-002",
    bookingId: "book-002",
    customerId: "user-4",
    customerName: "Tech Solutions Inc",
    status: "pending",
    items: [
      {
        description: "Area Rental - Level 3 Hall A (40,000 sq ft x 12 months)",
        quantity: 1,
        unitPrice: 480000.0,
        total: 480000.0,
      },
    ],
    subtotal: 480000.0,
    tax: 38400.0,
    total: 518400.0,
    dueDate: "2024-07-01",
    createdAt: "2024-06-15T00:00:00Z",
  },
]

// Mock Incidents
export const mockIncidents: Incident[] = [
  {
    id: "inc-001",
    type: "damage",
    title: "Forklift damage to pallet",
    description: "Minor damage to packaging on pallet during transport",
    severity: "low",
    status: "resolved",
    reportedBy: "user-3",
    reportedByName: "Mike Worker",
    warehouseId: "wh-001",
    location: "Aisle A2",
    affectedBookingId: "book-001",
    resolution: "Packaging replaced, contents undamaged",
    createdAt: "2024-06-20T14:30:00Z",
    resolvedAt: "2024-06-20T16:00:00Z",
  },
  {
    id: "inc-002",
    type: "safety",
    title: "Wet floor hazard",
    description: "Water leak from HVAC unit creating slip hazard",
    severity: "medium",
    status: "investigating",
    reportedBy: "user-6",
    reportedByName: "Lisa Chen",
    warehouseId: "wh-001",
    location: "Level 2 Hall A entrance",
    createdAt: "2024-06-24T10:00:00Z",
  },
]

// Mock Claims
export const mockClaims: Claim[] = [
  {
    id: "claim-001",
    customerId: "user-2",
    customerName: "Sarah Johnson",
    incidentId: "inc-001",
    bookingId: "book-001",
    type: "damage",
    description: "Claim for damaged packaging on 2 pallets",
    amount: 150.0,
    status: "approved",
    approvedAmount: 150.0,
    resolution: "Full reimbursement approved for packaging replacement",
    createdAt: "2024-06-21T09:00:00Z",
    resolvedAt: "2024-06-23T14:00:00Z",
  },
]

// Mock Notifications
export const mockNotifications: Notification[] = [
  {
    id: "notif-001",
    userId: "user-2",
    type: "booking",
    channel: "email",
    title: "Booking Confirmed",
    message: "Your booking #book-001 has been confirmed. 75 pallets ready for storage.",
    read: true,
    createdAt: "2024-06-01T08:00:00Z",
  },
  {
    id: "notif-002",
    userId: "user-2",
    type: "invoice",
    channel: "email",
    title: "Invoice Due Soon",
    message: "Invoice #inv-001 for $1,822.50 is due on June 15th.",
    read: false,
    createdAt: "2024-06-10T09:00:00Z",
  },
]

// Mock Worker Shifts
export const mockShifts: WorkerShift[] = [
  {
    id: "shift-001",
    workerId: "user-3",
    workerName: "Mike Worker",
    checkInTime: "2024-06-24T06:00:00Z",
    checkOutTime: "2024-06-24T14:30:00Z",
    hoursWorked: 8.5,
    breaks: [{ start: "2024-06-24T10:00:00Z", end: "2024-06-24T10:30:00Z" }],
    tasksCompleted: 5,
    warehouseId: "wh-001",
  },
]

// Dashboard Stats
export const mockDashboardStats: DashboardStats = {
  totalBookings: 156,
  activeBookings: 42,
  totalRevenue: 1250000,
  monthlyRevenue: 125000,
  totalCustomers: 87,
  warehouseUtilization: 68,
  pendingTasks: 12,
  openIncidents: 2,
}
