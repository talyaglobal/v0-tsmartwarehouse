-- Migration: Add Time Slot Fields to Bookings Table
-- Description: Add fields for pre-order time slot scheduling system
-- Created: 2025-01-XX

-- ============================================
-- Add time slot related columns to bookings table
-- ============================================

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS scheduled_dropoff_datetime TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS time_slot_set_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS time_slot_set_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS time_slot_confirmed_at TIMESTAMPTZ;

-- Create indexes for time slot queries
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_dropoff_datetime ON bookings(scheduled_dropoff_datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_time_slot_set_by ON bookings(time_slot_set_by);
CREATE INDEX IF NOT EXISTS idx_bookings_awaiting_time_slot ON bookings(warehouse_id, booking_status) 
  WHERE booking_status = 'pre_order' AND scheduled_dropoff_datetime IS NULL;

-- Update booking_status constraint to include 'pre_order' status
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_booking_status_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_booking_status_check 
CHECK (booking_status IN ('pending', 'pre_order', 'payment_pending', 'confirmed', 'active', 'completed', 'cancelled'));

-- Add comments to explain the new fields
COMMENT ON COLUMN bookings.scheduled_dropoff_datetime IS 'Scheduled date and time for pallet drop-off, set by warehouse worker';
COMMENT ON COLUMN bookings.time_slot_set_by IS 'Warehouse worker (profile ID) who set the time slot';
COMMENT ON COLUMN bookings.time_slot_set_at IS 'Timestamp when the time slot was set by warehouse worker';
COMMENT ON COLUMN bookings.time_slot_confirmed_at IS 'Timestamp when customer confirmed the time slot';
COMMENT ON COLUMN bookings.booking_status IS 'Booking status: pending, pre_order, payment_pending, confirmed, active, completed, cancelled';

