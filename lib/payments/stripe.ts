import Stripe from "stripe"

/**
 * Stripe Payment Gateway Integration
 * Handles all Stripe API interactions for payment processing
 */

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY not configured - Stripe payment features will be disabled")
}

export const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
  typescript: true,
}) : null

/**
 * Create a payment intent for an invoice
 */
export async function createPaymentIntent(params: {
  amount: number
  currency?: string
  customerId: string
  invoiceId: string
  metadata?: Record<string, string>
}): Promise<Stripe.PaymentIntent> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
  }

  const { amount, currency = "usd", customerId, invoiceId, metadata = {} } = params

  // Convert amount to cents (Stripe uses smallest currency unit)
  const amountInCents = Math.round(amount * 100)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency,
    customer: customerId, // Stripe customer ID (should be created separately)
    metadata: {
      invoice_id: invoiceId,
      customer_id: customerId,
      ...metadata,
    },
    automatic_payment_methods: {
      enabled: true,
    },
  })

  return paymentIntent
}

/**
 * Create a payment intent for booking deposit (10%) - no invoice
 */
export async function createDepositPaymentIntent(params: {
  amount: number
  currency?: string
  customerId: string
  bookingId: string
  customerEmail?: string
}): Promise<Stripe.PaymentIntent> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
  }

  const { amount, currency = "usd", customerId, bookingId, customerEmail } = params
  const amountInCents = Math.round(amount * 100)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency,
    customer: customerId,
    metadata: {
      booking_id: bookingId,
      payment_type: "deposit",
      ...(customerEmail && { customer_email: customerEmail }),
    },
    automatic_payment_methods: {
      enabled: true,
    },
  })

  return paymentIntent
}

/**
 * Retrieve a payment intent
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
  }
  return await stripe.paymentIntents.retrieve(paymentIntentId)
}

/**
 * Confirm a payment intent
 */
export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId?: string
): Promise<Stripe.PaymentIntent> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
  }
  const params: Stripe.PaymentIntentConfirmParams = {}
  if (paymentMethodId) {
    params.payment_method = paymentMethodId
  }

  return await stripe.paymentIntents.confirm(paymentIntentId, params)
}

/**
 * Create a refund
 */
export async function createRefund(params: {
  chargeId: string
  amount?: number
  reason?: Stripe.RefundCreateParams.Reason
  metadata?: Record<string, string>
}): Promise<Stripe.Refund> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
  }
  const { chargeId, amount, reason, metadata = {} } = params

  const refundParams: Stripe.RefundCreateParams = {
    charge: chargeId,
    metadata,
  }

  if (amount) {
    // Convert to cents
    refundParams.amount = Math.round(amount * 100)
  }

  if (reason) {
    refundParams.reason = reason
  }

  return await stripe.refunds.create(refundParams)
}

/**
 * Retrieve a refund
 */
export async function getRefund(refundId: string): Promise<Stripe.Refund> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
  }
  return await stripe.refunds.retrieve(refundId)
}

/**
 * Create or retrieve a Stripe customer
 */
export async function getOrCreateStripeCustomer(params: {
  email: string
  name: string
  metadata?: Record<string, string>
}): Promise<Stripe.Customer> {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.")
  }
  const { email, name, metadata = {} } = params

  // First, try to find existing customer by email
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  })

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0]
  }

  // Create new customer
  return await stripe.customers.create({
    email,
    name,
    metadata,
  })
}

