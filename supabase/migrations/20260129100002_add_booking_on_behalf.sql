-- Migration: Add booking on-behalf fields and booking_approvals table
-- Created: 2026-01-29
-- Purpose: Enable team admins to book on behalf of team members with optional approval
--
-- This migration:
-- 1. Adds booked_by_id, booked_on_behalf, requires_approval, approval_status to bookings
-- 2. Creates booking_approvals table for approval workflow
-- 3. Creates necessary indexes and triggers

-- =====================================================
-- PART 1: ADD ON-BEHALF COLUMNS TO BOOKINGS
-- =====================================================

-- Add booked_by_id - the person who created the booking (might be different from customer_id)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booked_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add booked_on_behalf flag
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booked_on_behalf BOOLEAN DEFAULT false;

-- Add requires_approval flag (when team admin wants customer approval)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;

-- Add approval_status for booking approval workflow
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS approval_status TEXT;

-- Add constraint for approval_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_approval_status_check'
  ) THEN
    ALTER TABLE bookings
    ADD CONSTRAINT bookings_approval_status_check 
    CHECK (approval_status IS NULL OR approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bookings_booked_by_id ON bookings(booked_by_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booked_on_behalf ON bookings(booked_on_behalf) WHERE booked_on_behalf = true;
CREATE INDEX IF NOT EXISTS idx_bookings_approval_status ON bookings(approval_status) WHERE approval_status IS NOT NULL;

-- Update existing bookings to set booked_by_id = customer_id where not set
UPDATE bookings 
SET booked_by_id = customer_id 
WHERE booked_by_id IS NULL AND customer_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN bookings.booked_by_id IS 'User who created the booking (may differ from customer_id for on-behalf bookings)';
COMMENT ON COLUMN bookings.booked_on_behalf IS 'True if booking was made by team admin on behalf of another team member';
COMMENT ON COLUMN bookings.requires_approval IS 'True if the booking requires approval from the customer';
COMMENT ON COLUMN bookings.approval_status IS 'Approval status: pending, approved, or rejected';

-- =====================================================
-- PART 2: CREATE BOOKING_APPROVALS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS booking_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Who requested the approval (team admin)
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_by_name TEXT,
  
  -- Who approved/rejected (the customer)
  responded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  responded_by_name TEXT,
  
  -- Approval status
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Notes/messages
  request_message TEXT,  -- Message from requester to customer
  response_message TEXT, -- Message from customer when approving/rejecting
  
  -- Timestamps
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- Optional: approval request expiration
  
  -- Ensure one approval per booking
  UNIQUE(booking_id),
  
  -- Status constraint
  CONSTRAINT booking_approvals_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'expired'))
);

-- Enable RLS
ALTER TABLE booking_approvals ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_booking_approvals_booking_id ON booking_approvals(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_approvals_requested_by ON booking_approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_booking_approvals_responded_by ON booking_approvals(responded_by);
CREATE INDEX IF NOT EXISTS idx_booking_approvals_status ON booking_approvals(status);
CREATE INDEX IF NOT EXISTS idx_booking_approvals_pending ON booking_approvals(status, requested_at) 
  WHERE status = 'pending';

-- Comments
COMMENT ON TABLE booking_approvals IS 'Approval requests for bookings made on behalf of team members';
COMMENT ON COLUMN booking_approvals.requested_by IS 'Team admin who made the booking on behalf of customer';
COMMENT ON COLUMN booking_approvals.responded_by IS 'Customer who approved or rejected the booking';
COMMENT ON COLUMN booking_approvals.expires_at IS 'Optional expiration time for the approval request';

-- =====================================================
-- PART 3: HELPER FUNCTIONS
-- =====================================================

-- Function to create a booking with approval request
CREATE OR REPLACE FUNCTION create_booking_on_behalf(
  p_booking_id TEXT,
  p_customer_id UUID,
  p_booked_by_id UUID,
  p_requires_approval BOOLEAN,
  p_request_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_approval_id UUID;
  v_booker_name TEXT;
BEGIN
  -- Update the booking with on-behalf info
  UPDATE bookings
  SET 
    booked_by_id = p_booked_by_id,
    booked_on_behalf = true,
    requires_approval = p_requires_approval,
    approval_status = CASE WHEN p_requires_approval THEN 'pending' ELSE NULL END
  WHERE id = p_booking_id;
  
  -- If approval is required, create approval record
  IF p_requires_approval THEN
    SELECT name INTO v_booker_name FROM profiles WHERE id = p_booked_by_id;
    
    INSERT INTO booking_approvals (
      booking_id,
      requested_by,
      requested_by_name,
      request_message,
      status
    ) VALUES (
      p_booking_id,
      p_booked_by_id,
      v_booker_name,
      p_request_message,
      'pending'
    )
    RETURNING id INTO v_approval_id;
    
    RETURN v_approval_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to approve a booking
CREATE OR REPLACE FUNCTION approve_booking(
  p_booking_id TEXT,
  p_user_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_customer_id UUID;
  v_user_name TEXT;
BEGIN
  -- Get customer_id from booking
  SELECT customer_id INTO v_customer_id FROM bookings WHERE id = p_booking_id;
  
  -- Check if user is the customer
  IF v_customer_id != p_user_id THEN
    RAISE EXCEPTION 'Only the booking customer can approve the booking';
  END IF;
  
  -- Get user name
  SELECT name INTO v_user_name FROM profiles WHERE id = p_user_id;
  
  -- Update booking approval status
  UPDATE bookings
  SET approval_status = 'approved'
  WHERE id = p_booking_id;
  
  -- Update approval record
  UPDATE booking_approvals
  SET 
    status = 'approved',
    responded_by = p_user_id,
    responded_by_name = v_user_name,
    response_message = p_message,
    responded_at = NOW()
  WHERE booking_id = p_booking_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a booking
CREATE OR REPLACE FUNCTION reject_booking(
  p_booking_id TEXT,
  p_user_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_customer_id UUID;
  v_user_name TEXT;
BEGIN
  -- Get customer_id from booking
  SELECT customer_id INTO v_customer_id FROM bookings WHERE id = p_booking_id;
  
  -- Check if user is the customer
  IF v_customer_id != p_user_id THEN
    RAISE EXCEPTION 'Only the booking customer can reject the booking';
  END IF;
  
  -- Get user name
  SELECT name INTO v_user_name FROM profiles WHERE id = p_user_id;
  
  -- Update booking approval status and mark as cancelled
  UPDATE bookings
  SET 
    approval_status = 'rejected',
    booking_status = 'cancelled'
  WHERE id = p_booking_id;
  
  -- Update approval record
  UPDATE booking_approvals
  SET 
    status = 'rejected',
    responded_by = p_user_id,
    responded_by_name = v_user_name,
    response_message = p_message,
    responded_at = NOW()
  WHERE booking_id = p_booking_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending approvals for a user (as customer)
CREATE OR REPLACE FUNCTION get_pending_approvals(p_user_id UUID)
RETURNS TABLE (
  approval_id UUID,
  booking_id TEXT,
  requested_by_id UUID,
  requested_by_name TEXT,
  request_message TEXT,
  requested_at TIMESTAMPTZ,
  warehouse_name TEXT,
  booking_type TEXT,
  start_date DATE,
  total_amount DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ba.id AS approval_id,
    ba.booking_id,
    ba.requested_by AS requested_by_id,
    ba.requested_by_name,
    ba.request_message,
    ba.requested_at,
    w.name AS warehouse_name,
    b.type AS booking_type,
    b.start_date,
    b.total_amount
  FROM booking_approvals ba
  JOIN bookings b ON ba.booking_id = b.id
  JOIN warehouses w ON b.warehouse_id = w.id
  WHERE b.customer_id = p_user_id
  AND ba.status = 'pending'
  ORDER BY ba.requested_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

