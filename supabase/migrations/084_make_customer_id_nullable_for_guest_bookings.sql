-- Migration: Make customer_id nullable for guest bookings
-- Description: Allow guest bookings by making customer_id nullable in bookings table
-- Created: 2025-12-29

-- Make customer_id nullable to support guest bookings
ALTER TABLE bookings
ALTER COLUMN customer_id DROP NOT NULL;

-- Add comment to explain the change
COMMENT ON COLUMN bookings.customer_id IS 'User ID (nullable for guest bookings). For guest bookings, use guest_email and is_guest_booking instead.';

-- Add a check constraint to ensure either customer_id or guest_email is present
ALTER TABLE bookings
ADD CONSTRAINT bookings_customer_or_guest_check
CHECK (
  (customer_id IS NOT NULL AND is_guest_booking = false) OR
  (guest_email IS NOT NULL AND is_guest_booking = true)
);
