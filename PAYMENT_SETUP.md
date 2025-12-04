# Payment Processing Setup Guide

This document describes the payment processing system implementation for TSmart Warehouse Management System.

## Overview

The payment processing system integrates with Stripe to handle invoice payments, credit balance management, and refunds. It supports multiple payment methods including credit cards and customer credit balances.

## Features Implemented

### ✅ Payment Gateway Integration (Stripe)
- Stripe payment intent creation and confirmation
- Customer management (create/retrieve Stripe customers)
- Payment processing with multiple methods (card, credit balance, both)
- Stripe API integration (`lib/payments/stripe.ts`)

### ✅ Invoice Payment Processing
- Payment creation for invoices
- Payment confirmation workflow
- Automatic invoice status updates on payment success
- Support for partial payments

### ✅ Credit Balance Management
- Customer credit balance tracking in database
- Credit balance usage for payments
- Credit balance adjustments via database functions
- Credit balance refunds

### ✅ Refund Handling
- Full and partial refunds
- Stripe refund integration
- Credit balance refunds
- Refund status tracking
- Automatic invoice status updates on refund

### ✅ Payment History
- Payment transaction tracking
- Payment history API endpoint
- Refund history tracking

## Database Schema

The payment system uses three main tables:

1. **payments** - Stores payment records for invoices
2. **payment_transactions** - Tracks all payment-related transactions
3. **refunds** - Stores refund records

See `supabase/migrations/003_payments_schema.sql` for the complete schema.

## Environment Variables

Add the following to your `.env.local` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key
STRIPE_PUBLISHABLE_KEY=pk_test_... # Your Stripe publishable key (for frontend)
```

**Note:** For production, use your live Stripe keys (starting with `sk_live_` and `pk_live_`).

## API Endpoints

### Payments

- `GET /api/v1/payments` - List payments (with filters)
  - Query params: `invoiceId`, `status`
  - Customers can only see their own payments
  - Admins can see all payments

- `POST /api/v1/payments` - Create payment for invoice
  - Body:
    ```json
    {
      "invoiceId": "string",
      "paymentMethod": "card" | "credit_balance" | "both",
      "amount": number (optional),
      "useCreditBalance": boolean (optional),
      "creditBalanceAmount": number (optional),
      "paymentMethodId": string (optional, for Stripe)
    }
    ```
  - Returns: Payment object and `clientSecret` (for Stripe payment intents)

- `POST /api/v1/payments/[id]/confirm` - Confirm payment after client-side confirmation
  - Body:
    ```json
    {
      "paymentMethodId": string (optional)
    }
    ```

- `GET /api/v1/payments/history` - Get payment history for customer
  - Returns: Payments and transactions for the authenticated customer

### Refunds

- `GET /api/v1/payments/refunds` - List refunds (with filters)
  - Query params: `paymentId`, `invoiceId`, `status`
  - Customers can only see their own refunds
  - Admins can see all refunds

- `POST /api/v1/payments/refunds` - Create refund for payment (Admin only)
  - Body:
    ```json
    {
      "paymentId": "string",
      "amount": number (optional, defaults to full amount),
      "reason": string (optional),
      "refundToCredit": boolean (optional, defaults to false)
    }
    ```

## Usage Examples

### Process Payment with Credit Card

```typescript
// 1. Create payment intent
const response = await fetch('/api/v1/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invoiceId: 'inv-123',
    paymentMethod: 'card'
  })
})

const { clientSecret } = await response.json()

// 2. Confirm payment on client-side using Stripe.js
const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
  }
})

// 3. Confirm payment on server
await fetch(`/api/v1/payments/${paymentId}/confirm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ paymentMethodId })
})
```

### Process Payment with Credit Balance

```typescript
const response = await fetch('/api/v1/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invoiceId: 'inv-123',
    paymentMethod: 'credit_balance'
  })
})
```

### Process Payment with Both Methods

```typescript
const response = await fetch('/api/v1/payments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invoiceId: 'inv-123',
    paymentMethod: 'both',
    creditBalanceAmount: 100.00 // Use $100 from credit balance
  })
})
```

### Process Refund

```typescript
const response = await fetch('/api/v1/payments/refunds', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paymentId: 'pay-123',
    amount: 50.00, // Optional, defaults to full amount
    reason: 'Customer request',
    refundToCredit: false // Set to true to refund to credit balance
  })
})
```

## Business Logic

The payment processing logic is located in `lib/business-logic/payments.ts`:

- `processInvoicePayment()` - Main payment processing function
- `confirmPayment()` - Confirm a payment after client-side confirmation
- `processRefund()` - Process refunds (full or partial)
- `getPaymentHistory()` - Get payment history for a customer

## Database Functions

Payment-related database operations are in `lib/db/payments.ts`:

- `getPayments()` - Fetch payments with filters
- `createPayment()` - Create a new payment record
- `updatePayment()` - Update payment status
- `getPaymentTransactions()` - Get transaction history
- `createPaymentTransaction()` - Create a transaction record
- `getRefunds()` - Fetch refunds with filters
- `createRefund()` - Create a refund record
- `getCustomerCreditBalance()` - Get customer's credit balance
- `updateCustomerCreditBalance()` - Update customer's credit balance

## Stripe Integration

The Stripe integration is in `lib/payments/stripe.ts`:

- `createPaymentIntent()` - Create a Stripe payment intent
- `getPaymentIntent()` - Retrieve a payment intent
- `confirmPaymentIntent()` - Confirm a payment intent
- `createRefund()` - Create a Stripe refund
- `getOrCreateStripeCustomer()` - Get or create a Stripe customer

## Testing

To test the payment system:

1. Set up a Stripe test account
2. Get your test API keys from the Stripe dashboard
3. Add the keys to your `.env.local` file
4. Use Stripe test cards (e.g., `4242 4242 4242 4242`)

## Next Steps

1. **Set up Stripe account** - Create a Stripe account and get your API keys
2. **Run database migration** - Execute `supabase/migrations/003_payments_schema.sql`
3. **Configure environment variables** - Add Stripe keys to `.env.local`
4. **Test payment flow** - Test with Stripe test cards
5. **Implement frontend** - Create payment UI components using Stripe.js

## Security Considerations

- All payment endpoints require authentication
- Customers can only access their own payments
- Only admins can create refunds
- Stripe secret keys should never be exposed to the client
- Use Stripe webhooks for payment status updates (recommended for production)

## Support

For issues or questions about the payment system, refer to:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)

