import Stripe from "stripe"

/**
 * Stripe Payment Gateway Integration
 * Handles all Stripe API interactions for payment processing
 */

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
})

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
 * Retrieve a payment intent
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return await stripe.paymentIntents.retrieve(paymentIntentId)
}

/**
 * Confirm a payment intent
 */
export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId?: string
): Promise<Stripe.PaymentIntent> {
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

