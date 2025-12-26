import { createServerSupabaseClient } from "@/lib/supabase/server"
import { PRICING } from "@/lib/constants"
import { getBookingById } from "@/lib/db/bookings"
import { createInvoice, getInvoices } from "@/lib/db/invoices"
import { getServiceOrderById } from "@/lib/db/orders"
import { calculatePalletPricing, calculateAreaRentalPricing } from "./pricing"
import { getMembershipSettingByTier } from "@/lib/db/membership"
import { getNotificationService } from "@/lib/notifications/service"
import type { Invoice, InvoiceItem, MembershipTier } from "@/types"

/**
 * Business Logic: Invoice Generation Automation
 * 
 * Automatically generates invoices for:
 * - New bookings (one-time charges)
 * - Monthly storage fees (recurring)
 * - Area rental fees (annual)
 * - Additional services
 */

const TAX_RATE = 0.08 // 8% tax rate (configurable)

export interface GenerateInvoiceInput {
  bookingId: string
  customerId: string
  customerName: string
  invoiceType: "booking" | "monthly-storage" | "annual-rental"
  membershipTier?: MembershipTier
  months?: number // For monthly storage invoices
}

export interface GenerateInvoiceResult {
  invoice: Invoice
  items: InvoiceItem[]
  message: string
}

/**
 * Generate invoice for a new booking
 */
export async function generateBookingInvoice(
  input: GenerateInvoiceInput
): Promise<GenerateInvoiceResult> {
  if (input.invoiceType !== "booking") {
    throw new Error("This function is only for booking invoices")
  }

  // Get booking details
  const booking = await getBookingById(input.bookingId)
  if (!booking) {
    throw new Error("Booking not found")
  }

  // This is simplified - in production, you'd get active bookings
  const existingPalletCount = 0

  // Calculate pricing breakdown
  let pricingResult
  let items: InvoiceItem[] = []

  if (booking.type === "pallet" && booking.palletCount) {
    pricingResult = await calculatePalletPricing({
      type: "pallet",
      warehouseId: booking.warehouseId,
      palletCount: booking.palletCount,
      months: 1, // Initial invoice is for first month
      membershipTier: input.membershipTier,
      existingPalletCount,
    })

    items = pricingResult.breakdown.map((item) => ({
      description: item.item,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    }))

    // Add discount line items if applicable
    if (pricingResult.volumeDiscount > 0) {
      items.push({
        description: `Volume Discount (${pricingResult.volumeDiscountPercent}%)`,
        quantity: 1,
        unitPrice: -pricingResult.volumeDiscount,
        total: -pricingResult.volumeDiscount,
      })
    }

    if (pricingResult.membershipDiscount > 0) {
      items.push({
        description: `Membership Discount (${pricingResult.membershipDiscountPercent}%)`,
        quantity: 1,
        unitPrice: -pricingResult.membershipDiscount,
        total: -pricingResult.membershipDiscount,
      })
    }
  } else if (booking.type === "area-rental" && booking.areaSqFt) {
    pricingResult = await calculateAreaRentalPricing({
      type: "area-rental",
      warehouseId: booking.warehouseId,
      areaSqFt: booking.areaSqFt,
      membershipTier: input.membershipTier,
    })

    items = pricingResult.breakdown.map((item) => ({
      description: item.item,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    }))

    if (pricingResult.membershipDiscount > 0) {
      items.push({
        description: `Membership Discount (${pricingResult.membershipDiscountPercent}%)`,
        quantity: 1,
        unitPrice: -pricingResult.membershipDiscount,
        total: -pricingResult.membershipDiscount,
      })
    }
  } else {
    throw new Error("Invalid booking type or missing required fields")
  }

  // Calculate subtotal, tax, and total
  const subtotal = pricingResult.finalAmount
  const tax = subtotal * TAX_RATE
  const total = subtotal + tax

  // Calculate due date (30 days from now)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  // Create invoice
  const invoice = await createInvoice({
    bookingId: input.bookingId,
    customerId: input.customerId,
    customerName: input.customerName,
    status: "pending",
    items,
    subtotal,
    tax,
    total,
    dueDate: dueDate.toISOString().split("T")[0],
  })

  // Send notification to customer
  try {
    const notificationService = getNotificationService()
    await notificationService.sendNotification({
      userId: input.customerId,
      type: "invoice",
      channels: ["email", "push"],
      title: "New Invoice",
      message: `A new invoice #${invoice.id.slice(0, 8)} has been generated for ${invoice.total.toFixed(2)}. Due date: ${dueDate.toLocaleDateString()}.`,
      template: "invoice-created",
      templateData: {
        invoiceId: invoice.id.slice(0, 8),
        amount: `$${invoice.total.toFixed(2)}`,
        dueDate: dueDate.toLocaleDateString(),
        status: "Pending",
        customerName: input.customerName,
      },
    })
  } catch (error) {
    console.error("Failed to send invoice notification:", error)
  }

  return {
    invoice,
    items,
    message: "Invoice generated successfully",
  }
}

/**
 * Generate monthly storage invoice for active pallet bookings
 */
export async function generateMonthlyStorageInvoice(
  input: GenerateInvoiceInput
): Promise<GenerateInvoiceResult> {
  if (input.invoiceType !== "monthly-storage") {
    throw new Error("This function is only for monthly storage invoices")
  }

  // Get booking
  const booking = await getBookingById(input.bookingId)
  if (!booking) {
    throw new Error("Booking not found")
  }

  if (booking.type !== "pallet" || !booking.palletCount) {
    throw new Error("Booking is not a pallet booking")
  }

  if (booking.status !== "active") {
    throw new Error("Booking is not active")
  }

  // Check if invoice already exists for this month
  const existingInvoices = await getInvoices({
    bookingId: input.bookingId,
  })

  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const hasInvoiceThisMonth = existingInvoices.some((inv) => {
    const invoiceMonth = new Date(inv.createdAt).toISOString().slice(0, 7)
    return invoiceMonth === currentMonth && inv.items.some((item) =>
      item.description.includes("Monthly Storage")
    )
  })

  if (hasInvoiceThisMonth) {
    throw new Error("Monthly invoice already generated for this month")
  }

  // Calculate storage cost using warehouse-specific pricing
  const supabase = createServerSupabaseClient()
  let storagePerPalletPerMonth: number
  let membershipDiscountPercent = 0

  // Try to get warehouse pricing
  const { data: warehousePricing } = await supabase
    .from('warehouse_pricing')
    .select('base_price, unit')
    .eq('warehouse_id', booking.warehouseId)
    .eq('pricing_type', 'pallet')
    .eq('status', true)
    .single()

  if (warehousePricing) {
    // Parse unit to determine pricing structure
    if (warehousePricing.unit.includes('per_month')) {
      storagePerPalletPerMonth = parseFloat(warehousePricing.base_price.toString())
    } else {
      storagePerPalletPerMonth = parseFloat(warehousePricing.base_price.toString())
    }
  } else {
    // Fall back to static pricing
    storagePerPalletPerMonth = PRICING.storagePerPalletPerMonth
  }

  // Get membership discount from database (dynamic)
  if (input.membershipTier) {
    try {
      const membershipSetting = await getMembershipSettingByTier(input.membershipTier)
      if (membershipSetting) {
        membershipDiscountPercent = membershipSetting.discountPercent
      }
    } catch (error) {
      // Fall back to static config if database lookup fails
      const membershipDiscountInfo = PRICING.membershipDiscounts.find(
        (d) => d.tier === input.membershipTier
      )
      membershipDiscountPercent = membershipDiscountInfo?.discountPercent || 0
    }
  }

  const storageCost = booking.palletCount * storagePerPalletPerMonth
  const membershipDiscount =
    membershipDiscountPercent > 0
      ? (storageCost * membershipDiscountPercent) / 100
      : 0

  const subtotal = storageCost - membershipDiscount
  const tax = subtotal * TAX_RATE
  const total = subtotal + tax

  // Build items
  const items: InvoiceItem[] = [
    {
      description: `Monthly Storage (${booking.palletCount} pallets)`,
      quantity: booking.palletCount,
      unitPrice: storagePerPalletPerMonth,
      total: storageCost,
    },
  ]

  if (membershipDiscount > 0) {
    items.push({
      description: `Membership Discount (${membershipDiscountPercent}%)`,
      quantity: 1,
      unitPrice: -membershipDiscount,
      total: -membershipDiscount,
    })
  }

  // Calculate due date (30 days from now)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  // Create invoice
  const invoice = await createInvoice({
    bookingId: input.bookingId,
    customerId: input.customerId,
    customerName: input.customerName,
    status: "pending",
    items,
    subtotal,
    tax,
    total,
    dueDate: dueDate.toISOString().split("T")[0],
  })

  return {
    invoice,
    items,
    message: "Monthly storage invoice generated successfully",
  }
}

/**
 * Generate annual area rental invoice
 */
export async function generateAnnualRentalInvoice(
  input: GenerateInvoiceInput
): Promise<GenerateInvoiceResult> {
  if (input.invoiceType !== "annual-rental") {
    throw new Error("This function is only for annual rental invoices")
  }

  // Get booking
  const booking = await getBookingById(input.bookingId)
  if (!booking) {
    throw new Error("Booking not found")
  }

  if (booking.type !== "area-rental" || !booking.areaSqFt) {
    throw new Error("Booking is not an area rental booking")
  }

  // Calculate pricing
  const pricingResult = await calculateAreaRentalPricing({
    type: "area-rental",
    warehouseId: booking.warehouseId,
    areaSqFt: booking.areaSqFt,
    membershipTier: input.membershipTier,
  })

  const items: InvoiceItem[] = pricingResult.breakdown.map((item) => ({
    description: item.item,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
  }))

  if (pricingResult.membershipDiscount > 0) {
    items.push({
      description: `Membership Discount (${pricingResult.membershipDiscountPercent}%)`,
      quantity: 1,
      unitPrice: -pricingResult.membershipDiscount,
      total: -pricingResult.membershipDiscount,
    })
  }

  const subtotal = pricingResult.finalAmount
  const tax = subtotal * TAX_RATE
  const total = subtotal + tax

  // Calculate due date (30 days from now)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  // Create invoice
  const invoice = await createInvoice({
    bookingId: input.bookingId,
    customerId: input.customerId,
    customerName: input.customerName,
    status: "pending",
    items,
    subtotal,
    tax,
    total,
    dueDate: dueDate.toISOString().split("T")[0],
  })

  return {
    invoice,
    items,
    message: "Annual rental invoice generated successfully",
  }
}

/**
 * Auto-generate invoices for all active bookings that need monthly invoices
 * This would typically be run as a scheduled job (cron)
 */
export async function generateMonthlyInvoicesForActiveBookings(): Promise<{
  generated: number
  errors: string[]
}> {
  const supabase = createServerSupabaseClient()

  // Get all active pallet bookings
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("id, customer_id, customer_name, pallet_count")
    .eq("type", "pallet")
    .eq("status", "active")

  if (error) {
    throw new Error(`Failed to fetch bookings: ${error.message}`)
  }

  const errors: string[] = []
  let generated = 0

  for (const booking of bookings || []) {
    try {
      // Get customer membership tier
      const { data: user } = await supabase
        .from("users")
        .select("membership_tier")
        .eq("id", booking.customer_id)
        .single()

      await generateMonthlyStorageInvoice({
        bookingId: booking.id,
        customerId: booking.customer_id,
        customerName: booking.customer_name,
        invoiceType: "monthly-storage",
        membershipTier: user?.membership_tier || "bronze",
      })
      generated++
    } catch (err) {
      errors.push(
        `Failed to generate invoice for booking ${booking.id}: ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }
  }

  return { generated, errors }
}

/**
 * Generate invoice for a service order
 */
export interface GenerateServiceOrderInvoiceInput {
  serviceOrderId: string
  customerId: string
  customerName: string
  membershipTier?: MembershipTier
}

export async function generateServiceOrderInvoice(
  input: GenerateServiceOrderInvoiceInput
): Promise<GenerateInvoiceResult> {
  // Fetch service order with items
  const order = await getServiceOrderById(input.serviceOrderId, false)
  
  if (!order) {
    throw new Error("Service order not found")
  }

  if (order.status !== 'completed') {
    throw new Error("Can only generate invoice for completed service orders")
  }

  // Calculate totals from order items
  const items: InvoiceItem[] = order.items.map(item => ({
    description: item.serviceName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.totalPrice,
  }))

  const subtotal = order.totalAmount

  // Apply membership discount if applicable
  let discountAmount = 0
  let discountPercent = 0
  if (input.membershipTier) {
    const membershipDiscount = PRICING.membershipDiscounts.find(
      d => d.tier === input.membershipTier
    )
    if (membershipDiscount) {
      discountPercent = membershipDiscount.discountPercent
      discountAmount = (subtotal * discountPercent) / 100
    }
  }

  const subtotalAfterDiscount = subtotal - discountAmount

  // Add discount line item if applicable
  if (discountAmount > 0) {
    items.push({
      description: `Membership Discount (${input.membershipTier} - ${discountPercent}%)`,
      quantity: 1,
      unitPrice: -discountAmount,
      total: -discountAmount,
    })
  }

  // Calculate tax and total
  const tax = subtotalAfterDiscount * TAX_RATE
  const total = subtotalAfterDiscount + tax

  // Calculate due date (30 days from now)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30)

  // Create invoice
  const invoice = await createInvoice({
    bookingId: order.bookingId || undefined,
    serviceOrderId: input.serviceOrderId,
    customerId: input.customerId,
    customerName: input.customerName,
    status: "pending",
    items,
    subtotal: subtotalAfterDiscount,
    tax,
    total,
    dueDate: dueDate.toISOString().split("T")[0],
  })

  // Send notification to customer
  try {
    const notificationService = getNotificationService()
    await notificationService.sendNotification({
      userId: input.customerId,
      type: "invoice",
      channels: ["email", "push"],
      title: "New Invoice",
      message: `A new invoice #${invoice.id.slice(0, 8)} has been generated for $${total.toFixed(2)}. Due date: ${dueDate.toLocaleDateString()}.`,
      template: "invoice-created",
      templateData: {
        invoiceId: invoice.id.slice(0, 8),
        amount: `$${total.toFixed(2)}`,
        dueDate: dueDate.toLocaleDateString(),
        status: "Pending",
        customerName: input.customerName,
      },
    })
  } catch (error) {
    console.error("Failed to send invoice notification:", error)
  }

  return {
    invoice,
    items,
    message: "Service order invoice generated successfully",
  }
}

