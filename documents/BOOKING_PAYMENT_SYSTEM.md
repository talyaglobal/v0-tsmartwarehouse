# Warehouse Booking & Payment System Implementation

## Overview
Complete booking flow with authentication checks, Stripe payment integration, and dashboard management.

## Database Changes

### Migration: 083_add_payment_fields_to_bookings.sql
Added the following fields to `bookings` table:
- `payment_status` - Track payment status (pending, processing, completed, failed, refunded)
- `payment_intent_id` - Stripe Payment Intent ID (unique)
- `payment_method_id` - Stripe Payment Method ID
- `guest_email` - Email for guest bookings
- `is_guest_booking` - Boolean flag for guest bookings
- `stripe_customer_id` - Stripe Customer ID
- `amount_paid` - Amount already paid
- `amount_due` - Amount remaining to be paid
- `paid_at` - Timestamp of payment completion
- `payment_notes` - Payment-related notes

Updated `booking_status` check constraint to include `payment_pending` status.

### Indexes Created
- idx_bookings_payment_status
- idx_bookings_payment_intent_id
- idx_bookings_stripe_customer_id
- idx_bookings_is_guest_booking
- idx_bookings_guest_email

## User Flows

### 1. Authenticated User Booking Flow
1. User views warehouse detail page
2. Clicks "Book Now" button
3. System checks auth status → AUTHENTICATED
4. Redirects to `/warehouses/[id]/review` with booking parameters
5. User reviews booking details
6. User clicks "Pay Now"
7. System creates Stripe Payment Intent
8. Redirects to `/payment` page
9. User enters payment details and submits
10. Upon successful payment:
    - Stripe webhook confirms payment
    - Booking status updated to "confirmed"
    - Payment status updated to "completed"
    - Booking appears in dashboard `/dashboard/bookings`
    - User redirected to `/payment-success` page

### 2. Guest Booking Flow
1. User views warehouse detail page
2. Clicks "Book Now" button
3. System checks auth status → NOT AUTHENTICATED
4. Redirects to login page with redirect URL
5. User can also click "Continue as Guest" option
6. Guest enters email address on review page
7. Proceeds to payment same as authenticated user
8. After payment, guest receives confirmation email
9. Guest can view booking with booking ID (no dashboard access)

### 3. Not Logged In → Login → Resume Booking
1. User views warehouse detail page
2. Clicks "Book Now" button
3. System checks auth status → NOT AUTHENTICATED
4. Redirects to `/login?redirect=/warehouses/[id]/review?...`
5. User logs in
6. Auth system redirects back to booking review page
7. User resumes booking process and proceeds to payment

## API Endpoints

### POST /api/v1/payments/create-intent
Creates a Stripe Payment Intent and booking record

**Request:**
```json
{
  "amount": 1500,
  "warehouseId": "uuid",
  "bookingDetails": {
    "type": "pallet",
    "palletCount": 10,
    "startDate": "2025-12-30",
    "endDate": "2025-12-31"
  },
  "customerEmail": "customer@example.com",
  "isGuest": false
}
```

**Response:**
```json
{
  "success": true,
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx",
  "bookingId": "booking-uuid"
}
```

### POST /api/v1/payments/webhook
Handles Stripe webhook events for payment confirmation

**Handled Events:**
- `payment_intent.succeeded` - Updates booking to "confirmed" status
- `payment_intent.payment_failed` - Updates booking to failed status

### POST /api/v1/payments/retrieve-intent
Retrieves payment intent details for the payment page

**Request:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx"
}
```

**Response:**
```json
{
  "success": true,
  "amount": 1500,
  "currency": "usd",
  "status": "requires_payment_method"
}
```

### GET /api/v1/bookings/[id]
Retrieves booking details (public endpoint for success page)

## Pages Created/Updated

### New Pages

#### `/warehouses/[id]/review`
Booking review/summary page
- Display warehouse details
- Show booking parameters (type, quantity, dates)
- Allow editing of booking details
- Display total amount
- For logged-in users: show email
- For guests: email input field
- "Pay Now" button → initiates payment
- "Cancel" button → go back

#### `/payment`
Stripe payment form page
- Stripe Elements payment form
- Display total amount
- Security information
- Handles payment submission

#### `/payment-success`
Payment confirmation page
- Success message with animation
- Booking details summary
- Booking ID
- Warehouse information
- Booking dates and amount
- Confirmation email notice
- "View My Bookings" button (if logged in)
- "Back to Search" button

### Updated Pages

#### `/warehouse/[id]` (Warehouse Detail)
- Updated "Book Now" button logic
- Checks authentication status
- Calculates total booking amount
- Redirects to login (if not authenticated) with return URL
- Redirects to booking review (if authenticated)

#### `/login`
- Already supports `redirect` query parameter
- Automatically redirects back to booking review after successful login

#### `/dashboard/bookings`
- Already displays user's bookings
- Will automatically show completed bookings after payment

## Frontend Components

### Warehouse Detail Page (`/warehouse/[id]/page.tsx`)
```tsx
const handleBookNow = () => {
  // Calculate total amount
  const daysBooked = calculateDays(startDate, endDate)
  const totalAmount = dailyRate * quantity * daysBooked
  
  // Build review URL with parameters
  const reviewUrl = `/warehouses/${warehouseId}/review?${params}`
  
  if (!session) {
    // Redirect to login
    router.push(`/login?redirect=${encodeURIComponent(reviewUrl)}`)
  } else {
    // Go directly to review
    router.push(reviewUrl)
  }
}
```

### Booking Review Page (`/warehouses/[id]/review/page.tsx`)
- Displays warehouse and booking details
- Allows modification of booking parameters
- Shows guest email input if not authenticated
- Handles payment initiation

### Payment Page (`/payment/page.tsx`)
- Stripe Elements integration
- Payment form with error handling
- Secure payment processing

### Success Page (`/payment-success/page.tsx`)
- Shows booking confirmation
- Displays booking details
- Provides next steps

## Stripe Integration

### Environment Variables Required
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Webhook Setup
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/v1/payments/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy webhook secret and add to `.env.local`

## Payment Flow Calculation

### Pricing Model (Simplified)
- Daily rate: $50 per pallet/sqft
- Total Amount = Daily Rate × Quantity × Days Booked

**Example:**
- Storage type: Pallet
- Quantity: 10 pallets
- Duration: 2 days (Dec 30 - Dec 31)
- Total: $50 × 10 × 2 = $1,000

### Update Pricing
To customize pricing, modify the `handleBookNow` function in `/warehouse/[id]/page.tsx`:
```tsx
const dailyRate = 50; // Change this value
```

## Booking Status Lifecycle

```
┌─────────────────────────────────────────────────┐
│ User clicks "Book Now"                          │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    AUTHENTICATED         NOT AUTHENTICATED
        │                     │
        ▼                     ▼
   REVIEW PAGE          LOGIN PAGE
        │                     │
        │          ┌──────────┘
        │          │
        │ (After login)
        └──────────┬──────────┐
                   │          │
                   ▼          ▼
            REVIEW PAGE    GUEST OPTION
                   │          │
                   └──────────┬────────┘
                              │
                              ▼
                       PAYMENT PAGE
                              │
                    ┌─────────┴─────────┐
                    │                   │
            Payment Successful    Payment Failed
                    │                   │
                    ▼                   ▼
         ┌─ WEBHOOK TRIGGERED ─┐  ERROR MESSAGE
         │                     │
         ▼                     ▼
    DB UPDATE            Show error,
    (confirmed)          retry payment
         │
         ▼
  PAYMENT SUCCESS PAGE
         │
         ▼
  DASHBOARD / MY BOOKINGS
```

## Testing Checklist

### Authenticated Flow
- [ ] Login as registered user
- [ ] View warehouse details
- [ ] Click "Book Now"
- [ ] Verify redirect to booking review
- [ ] Modify booking details
- [ ] Click "Pay Now"
- [ ] Fill in payment form (use test card)
- [ ] Complete payment
- [ ] Verify success page shows booking details
- [ ] Verify booking appears in dashboard

### Guest Flow
- [ ] View warehouse details without login
- [ ] Click "Book Now"
- [ ] Verify redirect to login page
- [ ] Click "Continue as Guest" (if implemented)
- [ ] Enter email address
- [ ] Click "Pay Now"
- [ ] Complete payment
- [ ] Verify success page shows booking details

### Login → Resume Booking
- [ ] View warehouse details without login
- [ ] Click "Book Now" (with parameters in URL)
- [ ] Verify redirect to login with redirect parameter
- [ ] Fill in login form
- [ ] Verify redirect back to booking review page
- [ ] Proceed with payment

### Payment Handling
- [ ] Use Stripe test card 4242 4242 4242 4242
- [ ] Use any future expiration date
- [ ] Use any CVC
- [ ] Verify successful payment updates booking status
- [ ] Use test card 4000 0000 0000 0002 for failed payment
- [ ] Verify failed payment shows error message

## Notes

1. **Pricing**: The current pricing model is simplified. Update according to your business logic.
2. **Email Notifications**: Email sending is commented as TODO. Implement using your email service.
3. **Guest Bookings**: Consider implementing a "Continue as Guest" button on the review page.
4. **Booking Modifications**: Users can modify booking details before payment is processed.
5. **Refunds**: Consider implementing refund logic in the webhook handler.
6. **Security**: Always validate amounts on the server side before creating payment intents.
