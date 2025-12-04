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
  hallId: z.string().uuid().optional(),
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
  status: z.enum(["pending", "confirmed", "active", "completed", "cancelled"]).optional(),
  notes: z.string().max(1000).optional(),
  palletCount: z.number().int().positive().optional(),
  areaSqFt: z.number().int().positive().min(40000).optional(),
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

