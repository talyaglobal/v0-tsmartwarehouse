-- Migration: Add Payment Fields to Bookings Table
-- Description: Add Stripe payment integration fields and guest email support
-- Created: 2025-12-29

-- ============================================
-- Add payment-related columns to bookings table
-- ============================================

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS payment_method_id TEXT,
ADD COLUMN IF NOT EXISTS guest_email TEXT,
ADD COLUMN IF NOT EXISTS is_guest_booking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_due DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- Create indexes for payment tracking
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_intent_id ON bookings(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_customer_id ON bookings(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_is_guest_booking ON bookings(is_guest_booking);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_email ON bookings(guest_email);

-- Add comment to explain payment fields
COMMENT ON COLUMN bookings.payment_status IS 'Payment status: pending, processing, completed, failed, refunded';
COMMENT ON COLUMN bookings.payment_intent_id IS 'Stripe Payment Intent ID for tracking payments';
COMMENT ON COLUMN bookings.payment_method_id IS 'Stripe Payment Method ID';
COMMENT ON COLUMN bookings.guest_email IS 'Email for guest bookings (when customer is not registered)';
COMMENT ON COLUMN bookings.is_guest_booking IS 'Flag to indicate if this is a guest booking';
COMMENT ON COLUMN bookings.stripe_customer_id IS 'Stripe Customer ID for recurring payments';
COMMENT ON COLUMN bookings.amount_paid IS 'Amount already paid';
COMMENT ON COLUMN bookings.amount_due IS 'Amount remaining to be paid';
COMMENT ON COLUMN bookings.paid_at IS 'Timestamp when payment was completed';
COMMENT ON COLUMN bookings.payment_notes IS 'Notes related to payment';

-- Update bookings_status check constraint to include 'payment_pending' status
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_booking_status_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_booking_status_check 
CHECK (booking_status IN ('pending', 'payment_pending', 'confirmed', 'active', 'completed', 'cancelled'));

-- Add comment to explain the booking_status values
COMMENT ON COLUMN bookings.booking_status IS 'Booking status: pending, payment_pending, confirmed, active, completed, cancelled';
