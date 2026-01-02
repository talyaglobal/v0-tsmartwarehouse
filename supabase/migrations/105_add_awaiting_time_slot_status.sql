-- Migration: Add Awaiting Time Slot Status and Date Change Fields
-- Description: Add awaiting_time_slot status and fields for warehouse staff to propose date/time changes
-- Created: 2025-01-XX

-- ============================================
-- Update booking_status constraint to include 'awaiting_time_slot'
-- ============================================

ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_booking_status_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_booking_status_check 
CHECK (booking_status IN ('pending', 'pre_order', 'awaiting_time_slot', 'payment_pending', 'confirmed', 'active', 'completed', 'cancelled'));

-- ============================================
-- Add date/time change proposal fields
-- ============================================

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS proposed_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS proposed_start_time TIME,
ADD COLUMN IF NOT EXISTS date_change_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS date_change_requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create indexes for date change queries
CREATE INDEX IF NOT EXISTS idx_bookings_proposed_start_date ON bookings(proposed_start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_date_change_requested_by ON bookings(date_change_requested_by);
CREATE INDEX IF NOT EXISTS idx_bookings_awaiting_time_slot_status ON bookings(warehouse_id, booking_status) 
  WHERE booking_status = 'awaiting_time_slot';

-- Add comments to explain the new fields
COMMENT ON COLUMN bookings.proposed_start_date IS 'Proposed new start date by warehouse staff';
COMMENT ON COLUMN bookings.proposed_start_time IS 'Proposed new start time by warehouse staff';
COMMENT ON COLUMN bookings.date_change_requested_at IS 'Timestamp when warehouse staff requested date/time change';
COMMENT ON COLUMN bookings.date_change_requested_by IS 'Warehouse staff (profile ID) who requested the date/time change';
COMMENT ON COLUMN bookings.booking_status IS 'Booking status: pending, pre_order, awaiting_time_slot, payment_pending, confirmed, active, completed, cancelled';

