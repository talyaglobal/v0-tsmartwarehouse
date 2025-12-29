# Warehouse Booking & Payment System - Setup Guide

## Quick Start

This guide will help you set up the complete booking and payment system for your TSmart Warehouse application.

## Prerequisites

- Node.js 18+
- Supabase account
- Stripe account
- NextAuth.js configured

## Step 1: Database Migration

The migration has already been applied to your Supabase database. It added:
- Payment status tracking fields
- Stripe integration fields
- Guest booking support
- Payment history fields

**Verify Migration Status:**
```bash
node scripts/apply-payment-migration.js
```

## Step 2: Environment Variables Setup

Add the following variables to your `.env.local`:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # Get from Stripe Dashboard
STRIPE_SECRET_KEY=sk_test_... # Get from Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_... # Get after setting up webhook
```

### Getting Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API Keys**
3. Copy your Publishable Key and Secret Key
4. Add them to `.env.local`

## Step 3: Stripe Webhook Setup

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://yourdomain.com/api/v1/payments/webhook`
   - For local testing: `http://localhost:3000/api/v1/payments/webhook`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### Testing Webhooks Locally

Use Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login to your Stripe account
stripe login

# Forward webhooks to local endpoint
stripe listen --forward-to localhost:3000/api/v1/payments/webhook

# Copy the webhook signing secret and add to .env.local
```

## Step 4: Test Stripe Cards

For testing purposes, use these Stripe test cards:

| Purpose | Card Number | Exp Date | CVC |
|---------|-------------|----------|-----|
| Success | 4242 4242 4242 4242 | Any future date | Any 3 digits |
| Decline | 4000 0000 0000 0002 | Any future date | Any 3 digits |
| Auth Required | 4000 0025 0000 3155 | Any future date | Any 3 digits |

## Step 5: Update Pricing Model

Current pricing is simplified ($50/day per unit). To customize:

**File:** `/app/warehouse/[id]/page.tsx`

```tsx
const handleBookNow = () => {
  const dailyRate = 50; // <- Change this value
  const quantity = parseInt(uomQty)
  const daysBooked = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const totalAmount = dailyRate * quantity * daysBooked
  // ...
}
```

### For Dynamic Pricing

Fetch pricing from warehouse details or create a separate pricing table:

```tsx
// Option 1: Use warehouse pricing
const dailyRate = warehouse.pricingPerUnit || 50

// Option 2: Create a pricing service
const calculatePrice = async (warehouseId, type, quantity, days) => {
  const response = await fetch(`/api/v1/pricing/calculate`, {
    method: 'POST',
    body: JSON.stringify({ warehouseId, type, quantity, days })
  })
  return response.json()
}
```

## Step 6: Email Notifications (Optional)

To send booking confirmation emails, implement email sending in:

**File:** `/app/api/v1/payments/webhook/route.ts`

```tsx
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // ... existing code ...
  
  // Send confirmation email
  await sendBookingConfirmationEmail(booking, paymentIntent)
}
```

Use your preferred email service:
- SendGrid
- Nodemailer
- AWS SES
- Resend

## System Architecture

### User Flow Diagram

```
┌─────────────────────────────────────────────┐
│ Warehouse Detail Page (/warehouse/[id])    │
│ - Book Now Button                          │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
   AUTHENTICATED         NOT AUTHENTICATED
        │                     │
        ▼                     ▼
 /warehouses/[id]/review   /auth/login
 (Booking Review)          (with redirect)
        │                     │
        └──────────┬──────────┘
                   │
                   ▼
        /warehouses/[id]/review
        (Final Review & Confirmation)
                   │
                   ▼
           Click "Pay Now"
                   │
                   ▼
  /api/v1/payments/create-intent
  (Create Stripe Payment Intent)
                   │
                   ▼
             /payment
          (Stripe Payment Form)
                   │
        ┌──────────┴──────────┐
        │                     │
     Success              Failure
        │                     │
        ▼                     ▼
   Webhook Event      Error Message
   (Background)        (Retry)
        │
        ▼
  Update Booking
  (confirmed)
        │
        ▼
/payment-success
(Confirmation Page)
        │
        ▼
/dashboard/bookings
(User Dashboard)
```

## File Structure

```
app/
├── warehouse/[id]/page.tsx           # Detail page with Book Now button
├── warehouses/[id]/review/page.tsx   # Booking review page
├── payment/page.tsx                  # Stripe payment form
├── payment-success/page.tsx          # Success confirmation
├── (auth)/login/page.tsx             # Login with redirect support
└── api/v1/
    ├── payments/
    │   ├── create-intent/route.ts    # Create payment intent
    │   ├── retrieve-intent/route.ts  # Get payment details
    │   └── webhook/route.ts          # Stripe webhook handler
    └── bookings/[id]/route.ts        # Booking details

supabase/migrations/
└── 083_add_payment_fields_to_bookings.sql  # Database migration

BOOKING_PAYMENT_SYSTEM.md                   # Comprehensive documentation
```

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/payments/create-intent` | Create Stripe Payment Intent |
| POST | `/api/v1/payments/retrieve-intent` | Get payment details |
| POST | `/api/v1/payments/webhook` | Handle Stripe webhooks |
| GET | `/api/v1/bookings/[id]` | Get booking details |

## Testing Checklist

### Authenticated User Flow
- [ ] Login to application
- [ ] View warehouse details
- [ ] Click "Book Now"
- [ ] Verify redirect to booking review page
- [ ] Modify booking details
- [ ] Click "Pay Now"
- [ ] Enter test card (4242 4242 4242 4242)
- [ ] Verify payment success
- [ ] Check booking in `/dashboard/bookings`

### Guest Booking Flow
- [ ] Logout or open in incognito
- [ ] View warehouse details
- [ ] Click "Book Now"
- [ ] Verify redirect to login page
- [ ] Enter email on review page
- [ ] Proceed to payment
- [ ] Verify success page shows booking details

### Payment Failure
- [ ] Use test card 4000 0000 0000 0002
- [ ] Verify error message appears
- [ ] Verify ability to retry payment

### Webhook Verification
- [ ] Monitor Stripe Dashboard for webhook delivery
- [ ] Check that booking status updates to "confirmed"
- [ ] Verify no errors in server logs

## Troubleshooting

### Webhook Not Received

1. Check Stripe Webhook Secret is correct
2. Verify endpoint URL is accessible
3. Check server logs for errors
4. Use Stripe CLI to test locally: `stripe trigger payment_intent.succeeded`

### Payment Intent Creation Fails

1. Verify Stripe Secret Key is correct
2. Check that amount is > 0
3. Verify customer email is provided
4. Check Stripe API status

### Booking Not Appearing in Dashboard

1. Check booking status in Supabase: should be "confirmed"
2. Verify webhook was received (check Stripe Dashboard)
3. Check browser localStorage for pending booking data
4. Refresh dashboard page

### Environment Variables Not Loading

1. Verify `.env.local` file exists
2. Ensure variables are prefixed correctly:
   - `NEXT_PUBLIC_*` - Client-side accessible
   - `STRIPE_*` - Server-side only
3. Restart development server after changes

## Production Deployment

### Before Going Live

1. [ ] Switch to Stripe Live keys
2. [ ] Update environment variables in production
3. [ ] Configure webhook with production domain
4. [ ] Test end-to-end with real cards
5. [ ] Set up error monitoring (Sentry)
6. [ ] Configure email notifications
7. [ ] Set up refund process
8. [ ] Review compliance requirements

### Payment Security

- Always validate amounts on the server
- Never log sensitive card data
- Use HTTPS in production
- Implement proper error handling
- Monitor failed payments
- Keep Stripe SDK updated

## Database Schema

### Bookings Table Updates

```sql
-- New fields added by migration 083

payment_status          TEXT DEFAULT 'pending'
payment_intent_id       TEXT UNIQUE
payment_method_id       TEXT
guest_email             TEXT
is_guest_booking        BOOLEAN DEFAULT false
stripe_customer_id      TEXT
amount_paid             DECIMAL(10, 2) DEFAULT 0
amount_due              DECIMAL(10, 2)
paid_at                 TIMESTAMPTZ
payment_notes           TEXT

-- Updated booking_status values
booking_status IN ('pending', 'payment_pending', 'confirmed', 'active', 'completed', 'cancelled')
```

## Support & Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Testing](https://stripe.com/docs/testing)
- [NextAuth.js Docs](https://next-auth.js.org)
- [Supabase Documentation](https://supabase.com/docs)

## Questions?

Refer to:
1. `BOOKING_PAYMENT_SYSTEM.md` - Comprehensive system documentation
2. Code comments in API routes
3. Stripe Dashboard for webhook logs
4. Server logs for debugging

---

**Last Updated:** December 29, 2025  
**System Version:** 1.0.0
