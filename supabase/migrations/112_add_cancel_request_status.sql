-- Add 'cancel_request' status to bookings
-- This allows customers to request cancellation for paid bookings
-- Warehouse owners/admins can then approve or reject the request
-- Created: 2026-01-XX

-- Step 1: Drop existing booking_status constraint
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- Find all CHECK constraints on bookings.booking_status
  FOR constraint_record IN
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'bookings'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%booking_status%'
  LOOP
    -- Drop the constraint
    EXECUTE format('ALTER TABLE bookings DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;
END $$;

-- Step 2: Add new constraint with 'cancel_request' status
ALTER TABLE bookings
ADD CONSTRAINT bookings_booking_status_check 
CHECK (booking_status IN ('pending', 'pre_order', 'awaiting_time_slot', 'payment_pending', 'confirmed', 'active', 'cancel_request', 'completed', 'cancelled'));

-- Step 3: Add cancel_request fields to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_requested_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
ADD COLUMN IF NOT EXISTS cancel_processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancel_processed_by UUID REFERENCES profiles(id);

-- Step 4: Create index for cancel requests
CREATE INDEX IF NOT EXISTS idx_bookings_cancel_request ON bookings(warehouse_id, booking_status) 
  WHERE booking_status = 'cancel_request';

-- Step 5: Update comment
COMMENT ON COLUMN bookings.booking_status IS 'Booking status: pending, pre_order, awaiting_time_slot, payment_pending, confirmed, active, cancel_request, completed, cancelled';
COMMENT ON COLUMN bookings.cancel_requested_at IS 'Timestamp when cancellation was requested';
COMMENT ON COLUMN bookings.cancel_requested_by IS 'User ID who requested cancellation';
COMMENT ON COLUMN bookings.cancel_reason IS 'Reason provided for cancellation request';
COMMENT ON COLUMN bookings.cancel_processed_at IS 'Timestamp when cancellation was processed (approved/rejected)';
COMMENT ON COLUMN bookings.cancel_processed_by IS 'User ID who processed the cancellation request';

