-- Migration: Fix get_pending_approvals function
-- Created: 2026-02-01
-- Purpose: Drop and recreate the function to clear any cache issues

-- Drop the existing function first
DROP FUNCTION IF EXISTS get_pending_approvals(UUID);

-- Recreate with correct column references
CREATE OR REPLACE FUNCTION get_pending_approvals(p_user_id UUID)
RETURNS TABLE (
  approval_id UUID,
  booking_id TEXT,
  requested_by_id UUID,
  requested_by_name TEXT,
  request_message TEXT,
  requested_at TIMESTAMPTZ,
  warehouse_name TEXT,
  booking_type_value TEXT,
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
    b.type AS booking_type_value,
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

COMMENT ON FUNCTION get_pending_approvals(UUID) IS 'Get pending booking approvals for a customer. Returns bookings where someone else requested approval.';
