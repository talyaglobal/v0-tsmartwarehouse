-- TSmart Warehouse Management System - Payment Remaining Function
-- Calculate total unpaid invoice amounts per customer
-- Generated: December 2024

-- ============================================
-- FUNCTION: Get Customer Payment Remaining
-- ============================================
CREATE OR REPLACE FUNCTION get_customer_payment_remaining(p_customer_id UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  total_invoiced DECIMAL(10, 2);
  total_paid DECIMAL(10, 2);
  remaining DECIMAL(10, 2);
BEGIN
  -- Calculate total invoiced amount for pending/overdue invoices
  SELECT COALESCE(SUM(total), 0) INTO total_invoiced
  FROM invoices
  WHERE customer_id = p_customer_id
    AND status IN ('pending', 'overdue', 'draft');
  
  -- Calculate total paid amount for those invoices
  SELECT COALESCE(SUM(p.amount), 0) INTO total_paid
  FROM payments p
  INNER JOIN invoices i ON p.invoice_id = i.id
  WHERE i.customer_id = p_customer_id
    AND i.status IN ('pending', 'overdue', 'draft')
    AND p.status = 'succeeded';
  
  -- Calculate remaining
  remaining := GREATEST(total_invoiced - total_paid, 0);
  
  RETURN remaining;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Get Customer Payment Summary
-- ============================================
CREATE OR REPLACE FUNCTION get_customer_payment_summary(p_customer_id UUID)
RETURNS TABLE(
  total_invoiced DECIMAL(10, 2),
  total_paid DECIMAL(10, 2),
  remaining_balance DECIMAL(10, 2),
  pending_invoices_count INTEGER,
  overdue_invoices_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH invoice_totals AS (
    SELECT 
      COALESCE(SUM(CASE WHEN status IN ('pending', 'overdue', 'draft', 'paid') THEN total ELSE 0 END), 0) AS total_invoiced,
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count
    FROM invoices
    WHERE customer_id = p_customer_id
  ),
  payment_totals AS (
    SELECT COALESCE(SUM(p.amount), 0) AS total_paid
    FROM payments p
    INNER JOIN invoices i ON p.invoice_id = i.id
    WHERE i.customer_id = p_customer_id
      AND p.status = 'succeeded'
  )
  SELECT 
    it.total_invoiced,
    pt.total_paid,
    GREATEST(it.total_invoiced - pt.total_paid, 0) AS remaining_balance,
    it.pending_count::INTEGER,
    it.overdue_count::INTEGER
  FROM invoice_totals it
  CROSS JOIN payment_totals pt;
END;
$$ LANGUAGE plpgsql;

