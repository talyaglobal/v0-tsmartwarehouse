-- Migration: Fix bookings status constraint
-- Description: Remove old conflicting status check constraint
-- Created: 2025-12-29

-- Drop the old bookings_status_check constraint
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_status_check;

-- The correct constraint bookings_booking_status_check already exists and includes payment_pending
-- No need to recreate it

-- Add comment
COMMENT ON COLUMN bookings.booking_status IS 'Booking status: pending, payment_pending, confirmed, active, completed, cancelled';
