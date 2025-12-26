/**
 * Zod validation schemas for API endpoints
 */

import { z } from "zod"

// Booking schemas
export const createBookingSchema = z.object({
  type: z.enum(["pallet", "area-rental"]),
  palletCount: z.number().int().positive().optional(),
  areaSqFt: z.number().int().positive().min(40000).optional(),
  floorNumber: z.number().int().min(1).max(3).optional(),
  hallId: z.string().optional(), // Made more flexible - UUID validation happens in API
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  months: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => {
    if (data.type === "pallet") {
      return data.palletCount !== undefined && data.palletCount > 0
    } else {
      return data.areaSqFt !== undefined && data.areaSqFt >= 40000
    }
  },
  {
    message: "palletCount is required for pallet bookings, areaSqFt (min 40000) is required for area-rental bookings",
  }
)

export const updateBookingSchema = z.object({
  type: z.enum(["pallet", "area-rental"]).optional(),
  status: z.enum(["pending", "confirmed", "active", "completed", "cancelled"]).optional(),
  notes: z.string().max(1000).optional(),
  palletCount: z.number().int().positive().optional(),
  areaSqFt: z.number().int().positive().min(40000).optional(),
  hallId: z.string().nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
})

// Task schemas
export const createTaskSchema = z.object({
  type: z.enum(["receiving", "putaway", "picking", "packing", "shipping", "inventory-check", "maintenance"]),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  warehouseId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  zone: z.string().optional(),
  location: z.string().max(100).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  assignedTo: z.string().uuid().optional(),
})

export const updateTaskSchema = z.object({
  status: z.enum(["pending", "assigned", "in-progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedTo: z.string().uuid().optional(),
  description: z.string().min(1).max(1000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
})

// Invoice schemas
export const updateInvoiceSchema = z.object({
  status: z.enum(["draft", "pending", "paid", "overdue", "cancelled"]).optional(),
  notes: z.string().max(1000).optional(),
})

// Query parameter schemas for GET requests
export const bookingsQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(["pending", "confirmed", "active", "completed", "cancelled"]).optional(),
  type: z.enum(["pallet", "area-rental"]).optional(),
  warehouseId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
})

export const invoicesQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(["draft", "pending", "paid", "overdue", "cancelled"]).optional(),
  bookingId: z.string().uuid().optional(),
})

// Incident schemas
export const createIncidentSchema = z.object({
  type: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  warehouseId: z.string().uuid(),
  location: z.string().max(100).optional(),
  affectedBookingId: z.string().uuid().optional(),
})

export const updateIncidentSchema = z.object({
  status: z.enum(["open", "investigating", "resolved", "closed"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  resolution: z.string().max(2000).optional(),
})

// Claim schemas
export const createClaimSchema = z.object({
  type: z.enum(["damage", "loss", "delay", "other"]),
  description: z.string().min(1).max(2000),
  amount: z.number().positive(),
  bookingId: z.string().uuid(),
  incidentId: z.string().uuid().optional(),
  evidenceFiles: z.array(z.string().url()).optional(),
})

export const updateClaimSchema = z.object({
  status: z.enum(["submitted", "under-review", "approved", "rejected", "paid"]).optional(),
  notes: z.string().max(1000).optional(),
  amount: z.number().positive().optional(),
})

// Notification preferences schema
export const updateNotificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  emailAddress: z.string().email().optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format").optional(),
  whatsappNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid WhatsApp number format").optional(),
  typePreferences: z.record(
    z.string(),
    z.object({
      email: z.boolean(),
      sms: z.boolean(),
      push: z.boolean(),
      whatsapp: z.boolean(),
    })
  ).optional(),
})

// Access Log schemas
export const createAccessLogSchema = z.object({
  visitorType: z.enum(["vehicle", "staff", "customer", "visitor", "family_friend", "delivery_driver", "other"]),
  warehouseId: z.string().uuid(),
  entryTime: z.string().datetime().optional(), // ISO 8601 datetime string
  status: z.enum(["checked_in", "checked_out"]).default("checked_in"),
  // Person Details
  personName: z.string().min(1).max(200),
  personIdNumber: z.string().max(100).optional(),
  personPhone: z.string().max(50).optional(),
  personEmail: z.string().email().max(200).optional(),
  companyName: z.string().max(200).optional(),
  personId: z.string().uuid().optional(),
  // Vehicle Details
  vehicleLicensePlate: z.string().max(50).optional(),
  vehicleMake: z.string().max(100).optional(),
  vehicleModel: z.string().max(100).optional(),
  vehicleColor: z.string().max(50).optional(),
  vehicleType: z.enum(["car", "truck", "van", "motorcycle", "suv", "other"]).optional(),
  // Visit Details
  purpose: z.string().max(500).optional(),
  authorizedBy: z.string().max(200).optional(),
  authorizedById: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  photoUrl: z.string().url().max(500).optional(),
  checkedInBy: z.string().uuid().optional(),
})

export const updateAccessLogSchema = z.object({
  exitTime: z.string().datetime().optional(),
  status: z.enum(["checked_in", "checked_out"]).optional(),
  personName: z.string().min(1).max(200).optional(),
  personIdNumber: z.string().max(100).optional(),
  personPhone: z.string().max(50).optional(),
  personEmail: z.string().email().max(200).optional(),
  companyName: z.string().max(200).optional(),
  vehicleLicensePlate: z.string().max(50).optional(),
  vehicleMake: z.string().max(100).optional(),
  vehicleModel: z.string().max(100).optional(),
  vehicleColor: z.string().max(50).optional(),
  vehicleType: z.enum(["car", "truck", "van", "motorcycle", "suv", "other"]).optional(),
  purpose: z.string().max(500).optional(),
  authorizedBy: z.string().max(200).optional(),
  bookingId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  photoUrl: z.string().url().max(500).optional(),
  checkedOutBy: z.string().uuid().optional(),
})

export const accessLogsQuerySchema = z.object({
  visitorType: z.enum(["vehicle", "staff", "customer", "visitor", "family_friend", "delivery_driver", "other"]).optional(),
  warehouseId: z.string().uuid().optional(),
  status: z.enum(["checked_in", "checked_out"]).optional(),
  personId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
})

