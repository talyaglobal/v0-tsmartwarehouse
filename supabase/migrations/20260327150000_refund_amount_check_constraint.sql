-- Add DB-level guard: refund_amount cannot exceed amount_paid on the same booking.
-- This backs up the application-level check in processCancellationRefund() and
-- prevents any direct SQL writes from creating an over-refund.

-- The constraint is deferred to INITIALLY DEFERRED so it is evaluated at
-- COMMIT time, which allows the booking update and refund update to happen
-- in a single transaction without ordering constraints.

ALTER TABLE public.bookings
  ADD CONSTRAINT chk_refund_amount_not_exceeds_paid
  CHECK (
    refund_amount IS NULL
    OR amount_paid IS NULL
    OR refund_amount <= amount_paid
  );

COMMENT ON CONSTRAINT chk_refund_amount_not_exceeds_paid ON public.bookings
  IS 'Prevents refund_amount from exceeding the amount already paid by the customer';
