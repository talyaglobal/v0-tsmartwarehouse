import {
  createPaymentIntent,
  confirmPaymentIntent,
  getOrCreateStripeCustomer,
  createRefund as createStripeRefund,
} from "@/lib/payments/stripe"
import {
  createPayment,
  updatePayment,
  getPaymentById,
  createPaymentTransaction,
  updateCustomerCreditBalance,
  getCustomerCreditBalance,
  createRefund,
} from "@/lib/db/payments"
import { getInvoiceById, updateInvoice } from "@/lib/db/invoices"
import { getBookingById } from "@/lib/db/bookings"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Payment, PaymentStatus, Refund } from "@/types"

/**
 * Business Logic: Payment Processing
 * 
 * Handles:
 * - Invoice payment processing (Stripe + credit balance)
 * - Credit balance management
 * - Refund processing
 * - Payment history tracking
 */

export interface ProcessPaymentInput {
  invoiceId: string
  customerId: string
  paymentMethod: "card" | "credit_balance" | "both"
  amount?: number // If not provided, uses invoice total
  useCreditBalance?: boolean
  creditBalanceAmount?: number
  paymentMethodId?: string // For Stripe card payments
}

export interface ProcessPaymentResult {
  payment: Payment
  message: string
  clientSecret?: string // For Stripe payment intents
}

/**
 * Process payment for an invoice
 */
export async function processInvoicePayment(
  input: ProcessPaymentInput
): Promise<ProcessPaymentResult> {
  // Get invoice
  const invoice = await getInvoiceById(input.invoiceId)
  if (!invoice) {
    throw new Error("Invoice not found")
  }

  if (invoice.status === "paid") {
    throw new Error("Invoice is already paid")
  }

  if (invoice.customerId !== input.customerId) {
    throw new Error("Invoice does not belong to this customer")
  }

  // Validate time slot for pre-order bookings
  if (invoice.bookingId) {
    const booking = await getBookingById(invoice.bookingId, false)
    if (booking) {
      if (booking.status === "pre_order") {
        if (!booking.scheduledDropoffDatetime) {
          throw new Error("Time slot has not been set by warehouse worker. Please wait for warehouse to assign a time slot.")
        }
        if (!booking.timeSlotConfirmedAt) {
          throw new Error("Time slot has not been confirmed. Please confirm the assigned time slot before proceeding with payment.")
        }
      }
    }
  }

  const amountToPay = input.amount || invoice.total
  let remainingAmount = amountToPay
  let creditBalanceUsed = 0

  // Check if using credit balance
  if (input.useCreditBalance || input.paymentMethod === "credit_balance" || input.paymentMethod === "both") {
    const creditBalance = await getCustomerCreditBalance(input.customerId)
    const creditToUse = input.creditBalanceAmount || Math.min(creditBalance, remainingAmount)
    
    if (creditToUse > 0 && creditBalance >= creditToUse) {
      creditBalanceUsed = creditToUse
      remainingAmount -= creditToUse
      
      // Deduct from credit balance
      await updateCustomerCreditBalance(input.customerId, -creditBalanceUsed)
    }
  }

  // Create payment record
  let payment: Payment
  let stripePaymentIntentId: string | undefined
  let clientSecret: string | undefined

  if (remainingAmount > 0 && (input.paymentMethod === "card" || input.paymentMethod === "both")) {
    // Process card payment via Stripe
    if (!input.paymentMethodId) {
      // Get customer email and name from booking (most reliable source)
      // Booking always has customerEmail and customerName
      let customerEmail: string
      let customerName: string = invoice.customerName || "Customer"

      // Get email from booking (booking always has customerEmail)
      if (invoice.bookingId) {
        const booking = await getBookingById(invoice.bookingId, false)
        if (booking) {
          customerEmail = booking.customerEmail
          if (booking.customerName) {
            customerName = booking.customerName
          }
        } else {
          throw new Error("Booking not found for this invoice")
        }
      } else {
        // If no booking, try to get from auth (for service orders or other invoice types)
        const supabase = createServerSupabaseClient()
        
        // Use service role to get user by ID
        try {
          const { data: { user: authUser }, error: authError } = await supabase.auth.admin.getUserById(input.customerId)
          
          if (authError || !authUser || !authUser.email) {
            throw new Error("Unable to retrieve customer email. Please ensure the booking exists.")
          }
          
          customerEmail = authUser.email
          if (authUser.user_metadata?.name) {
            customerName = authUser.user_metadata.name
          } else if (authUser.email) {
            customerName = authUser.email.split("@")[0]
          }
        } catch (error) {
          throw new Error("Customer email not found. Please ensure the booking exists and has customer information.")
        }
      }

      // Final validation
      if (!customerEmail) {
        throw new Error("Customer email is required for payment processing. Please contact support.")
      }

      const stripeCustomer = await getOrCreateStripeCustomer({
        email: customerEmail,
        name: customerName,
        metadata: {
          customer_id: input.customerId,
        },
      })

      const paymentIntent = await createPaymentIntent({
        amount: remainingAmount,
        customerId: stripeCustomer.id,
        invoiceId: input.invoiceId,
        metadata: {
          invoice_id: input.invoiceId,
          customer_id: input.customerId,
        },
      })

      stripePaymentIntentId = paymentIntent.id
      clientSecret = paymentIntent.client_secret || undefined

      // Create payment record with pending status
      payment = await createPayment({
        invoiceId: input.invoiceId,
        customerId: input.customerId,
        amount: amountToPay,
        currency: "USD",
        status: "pending",
        paymentMethod: input.paymentMethod === "both" ? "card" : "card",
        stripePaymentIntentId,
        creditBalanceUsed: creditBalanceUsed > 0 ? creditBalanceUsed : undefined,
      })
    } else {
      // Confirm payment with provided payment method
      // This would be called after client-side confirmation
      throw new Error("Payment confirmation should be handled via confirmPayment endpoint")
    }
  } else if (remainingAmount === 0 && creditBalanceUsed > 0) {
    // Payment fully covered by credit balance
    payment = await createPayment({
      invoiceId: input.invoiceId,
      customerId: input.customerId,
      amount: amountToPay,
      currency: "USD",
      status: "succeeded",
      paymentMethod: "credit_balance",
      creditBalanceUsed,
    })

    // Update invoice status
    await updateInvoice(input.invoiceId, {
      status: "paid",
      paidDate: new Date().toISOString().split("T")[0],
    })

    // Update booking status if invoice has a booking
    if (invoice.bookingId) {
      const { updateBooking, getBookingById } = await import("@/lib/db/bookings")
      const booking = await getBookingById(invoice.bookingId, false)
      if (booking) {
        // Update booking status to confirmed when payment succeeds via credit balance
        // Allow status update for: pending, pre_order, payment_pending, awaiting_time_slot
        const allowedStatuses = ["pending", "pre_order", "payment_pending", "awaiting_time_slot"]
        if (allowedStatuses.includes(booking.status)) {
          await updateBooking(invoice.bookingId, {
            status: "confirmed",
          })
        }
      }
    }

    // Create transaction records
    if (creditBalanceUsed > 0) {
      await createPaymentTransaction({
        paymentId: payment.id,
        type: "credit_adjustment",
        amount: -creditBalanceUsed,
        currency: "USD",
        status: "succeeded",
        description: `Credit balance used for invoice ${invoice.id}`,
      })
    }
    await createPaymentTransaction({
      paymentId: payment.id,
      type: "payment",
      amount: amountToPay,
      currency: "USD",
      status: "succeeded",
      description: `Payment for invoice ${invoice.id} using credit balance`,
    })
  } else {
    throw new Error("Invalid payment method or insufficient funds")
  }

  return {
    payment,
    message: creditBalanceUsed > 0
      ? `Payment processed: $${creditBalanceUsed.toFixed(2)} from credit balance${remainingAmount > 0 ? `, $${remainingAmount.toFixed(2)} via card` : ""}`
      : `Payment intent created for $${remainingAmount.toFixed(2)}`,
    clientSecret,
  }
}

/**
 * Confirm a payment after client-side confirmation
 */
export async function confirmPayment(
  paymentId: string,
  paymentMethodId?: string
): Promise<Payment> {
  const payment = await getPaymentById(paymentId)
  if (!payment) {
    throw new Error("Payment not found")
  }

  if (payment.status !== "pending") {
    throw new Error(`Payment is not pending. Current status: ${payment.status}`)
  }

  if (!payment.stripePaymentIntentId) {
    throw new Error("Payment does not have a Stripe payment intent")
  }

  // Confirm payment intent
  const paymentIntent = await confirmPaymentIntent(
    payment.stripePaymentIntentId,
    paymentMethodId
  )

  // Update payment status based on Stripe response
  let status: PaymentStatus = "processing"
  if (paymentIntent.status === "succeeded") {
    status = "succeeded"
  } else if (paymentIntent.status === "requires_action") {
    status = "processing"
  } else if (paymentIntent.status === "canceled" || paymentIntent.status === "requires_payment_method") {
    status = "failed"
  }

  const updatedPayment = await updatePayment(paymentId, {
    status,
    stripeChargeId: paymentIntent.latest_charge as string | undefined,
    completedAt: status === "succeeded" ? new Date().toISOString() : undefined,
  })

  // If payment succeeded, update invoice and booking
  if (status === "succeeded") {
    const invoice = await getInvoiceById(payment.invoiceId)
    if (invoice && invoice.status !== "paid") {
      await updateInvoice(payment.invoiceId, {
        status: "paid",
        paidDate: new Date().toISOString().split("T")[0],
      })

      // Update booking status if invoice has a booking
      if (invoice.bookingId) {
        const { updateBooking, getBookingById } = await import("@/lib/db/bookings")
        const booking = await getBookingById(invoice.bookingId, false)
        if (booking) {
          // Update booking status to confirmed when payment succeeds
          // Allow status update for: pending, pre_order, payment_pending, awaiting_time_slot
          const allowedStatuses = ["pending", "pre_order", "payment_pending", "awaiting_time_slot"]
          if (allowedStatuses.includes(booking.status)) {
            await updateBooking(invoice.bookingId, {
              status: "confirmed",
            })
          }
        }
      }
    }

    // Create transaction record
    await createPaymentTransaction({
      paymentId: payment.id,
      type: "payment",
      amount: payment.amount,
      currency: payment.currency,
      status: "succeeded",
      description: `Payment confirmed for invoice ${payment.invoiceId}`,
    })
  }

  return updatedPayment
}

/**
 * Process a refund
 */
export interface ProcessRefundInput {
  paymentId: string
  amount?: number // If not provided, refunds full amount
  reason?: string
  refundToCredit?: boolean // If true, refunds to credit balance instead of original payment method
}

export async function processRefund(input: ProcessRefundInput): Promise<Refund> {
  const payment = await getPaymentById(input.paymentId)
  if (!payment) {
    throw new Error("Payment not found")
  }

  if (payment.status !== "succeeded") {
    throw new Error(`Cannot refund payment with status: ${payment.status}`)
  }

  const refundAmount = input.amount || payment.amount

  if (refundAmount > payment.amount) {
    throw new Error("Refund amount cannot exceed payment amount")
  }

  let stripeRefundId: string | undefined
  let refundStatus: "pending" | "succeeded" | "failed" | "cancelled" = "pending"

  // If payment was made via Stripe, process Stripe refund
  if (payment.stripeChargeId && !input.refundToCredit) {
    try {
      const stripeRefund = await createStripeRefund({
        chargeId: payment.stripeChargeId,
        amount: refundAmount,
        reason: input.reason ? (input.reason as any) : undefined,
        metadata: {
          payment_id: payment.id,
          invoice_id: payment.invoiceId,
        },
      })

      stripeRefundId = stripeRefund.id
      refundStatus = stripeRefund.status === "succeeded" ? "succeeded" : "pending"
    } catch (error) {
      refundStatus = "failed"
      throw new Error(`Stripe refund failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  } else if (input.refundToCredit || payment.paymentMethod === "credit_balance") {
    // Refund to credit balance
    await updateCustomerCreditBalance(payment.customerId, refundAmount)
    refundStatus = "succeeded"
  }

  // Create refund record
  const refund = await createRefund({
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    customerId: payment.customerId,
    amount: refundAmount,
    currency: payment.currency,
    reason: input.reason,
    status: refundStatus,
    stripeRefundId,
    processedAt: refundStatus === "succeeded" ? new Date().toISOString() : undefined,
  })

  // Update payment status
  const newPaymentStatus: PaymentStatus =
    refundAmount === payment.amount ? "refunded" : "partially_refunded"
  await updatePayment(payment.id, {
    status: newPaymentStatus,
  })

  // Update invoice status if fully refunded
  if (refundAmount === payment.amount) {
    const invoice = await getInvoiceById(payment.invoiceId)
    if (invoice) {
      await updateInvoice(payment.invoiceId, {
        status: "pending", // Reset to pending after refund
      })
    }
  }

  return refund
}

/**
 * Get payment history for a customer
 */
export async function getPaymentHistory(customerId: string) {
  const { getPayments, getPaymentTransactions } = await import("@/lib/db/payments")
  
  const payments = await getPayments({ customerId })
  const transactions = await Promise.all(
    payments.map((p) => getPaymentTransactions({ paymentId: p.id }))
  )

  return {
    payments,
    transactions: transactions.flat(),
  }
}

