-- Booking cancellation and refund tracking
-- Implements: Cancellation workflow with time-based refund policy

-- ============================================
-- 1. Add cancellation fields to bookings
-- ============================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_type TEXT CHECK (cancel_type IN ('customer', 'warehouse', 'admin')),
  ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_percent INTEGER DEFAULT 0 CHECK (refund_percent >= 0 AND refund_percent <= 100),
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_error TEXT,
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

COMMENT ON COLUMN public.bookings.cancelled_at IS 'Timestamp when booking was cancelled';
COMMENT ON COLUMN public.bookings.cancellation_reason IS 'Reason for cancellation (user-provided or policy-based)';
COMMENT ON COLUMN public.bookings.cancelled_by IS 'User who cancelled the booking';
COMMENT ON COLUMN public.bookings.cancel_type IS 'Type of cancellation: customer, warehouse, or admin';
COMMENT ON COLUMN public.bookings.refund_amount IS 'Amount refunded to customer';
COMMENT ON COLUMN public.bookings.refund_percent IS 'Refund percentage (0-100)';
COMMENT ON COLUMN public.bookings.stripe_refund_id IS 'Stripe refund ID for tracking';
COMMENT ON COLUMN public.bookings.refund_error IS 'Error message if refund failed';
COMMENT ON COLUMN public.bookings.payment_intent_id IS 'Stripe PaymentIntent ID for deposit';

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_bookings_cancelled_at ON public.bookings(cancelled_at) WHERE cancelled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_cancelled_by ON public.bookings(cancelled_by) WHERE cancelled_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_payment_intent_id ON public.bookings(payment_intent_id) WHERE payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_refund_id ON public.bookings(stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;

-- ============================================
-- 2. Create payment events audit trail
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  checkout_request_id UUID REFERENCES public.pallet_checkout_requests(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'deposit_created',
    'deposit_succeeded',
    'deposit_failed',
    'checkout_created',
    'checkout_succeeded',
    'checkout_failed',
    'refund_created',
    'refund_succeeded',
    'refund_failed',
    'amount_adjusted'
  )),
  amount DECIMAL(10, 2) NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_refund_id TEXT,
  stripe_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_events_booking_id ON public.payment_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_checkout_request_id ON public.payment_events(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_type ON public.payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_created_at ON public.payment_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_stripe_payment_intent_id ON public.payment_events(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_stripe_refund_id ON public.payment_events(stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;

COMMENT ON TABLE public.payment_events IS 'Audit trail for all payment-related events';

-- ============================================
-- 3. RLS Policies for payment_events
-- ============================================
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Customers can view their own payment events
CREATE POLICY payment_events_select_own ON public.payment_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = payment_events.booking_id
        AND bookings.customer_id = auth.uid()
    )
  );

-- Warehouse staff can view events for their warehouses
CREATE POLICY payment_events_select_warehouse_staff ON public.payment_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.warehouse_staff ws ON ws.warehouse_id = b.warehouse_id
      WHERE b.id = payment_events.booking_id
        AND ws.user_id = auth.uid()
        AND ws.status = true
    )
  );

-- Admins can view all payment events
CREATE POLICY payment_events_select_admin ON public.payment_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'root'
    )
  );

-- Only system can insert payment events (via service role)
CREATE POLICY payment_events_insert_system ON public.payment_events
  FOR INSERT
  WITH CHECK (false);  -- Prevents user inserts; service role bypasses this

-- ============================================
-- 4. Function to log payment events
-- ============================================
CREATE OR REPLACE FUNCTION public.log_payment_event(
  p_booking_id TEXT,
  p_event_type TEXT,
  p_amount DECIMAL,
  p_checkout_request_id UUID DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_stripe_refund_id TEXT DEFAULT NULL,
  p_stripe_event_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'completed',
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.payment_events (
    booking_id,
    checkout_request_id,
    event_type,
    amount,
    stripe_payment_intent_id,
    stripe_refund_id,
    stripe_event_id,
    status,
    error_message,
    metadata
  ) VALUES (
    p_booking_id,
    p_checkout_request_id,
    p_event_type,
    p_amount,
    p_stripe_payment_intent_id,
    p_stripe_refund_id,
    p_stripe_event_id,
    p_status,
    p_error_message,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION public.log_payment_event IS 'Log payment event to audit trail (SECURITY DEFINER for service role access)';

-- ============================================
-- 5. Webhook event deduplication table
-- ============================================
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB,
  processing_result TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_event_id ON public.stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at ON public.stripe_webhook_events(processed_at DESC);

COMMENT ON TABLE public.stripe_webhook_events IS 'Prevents replay attacks by tracking processed Stripe webhook events';

-- ============================================
-- 6. Function to check webhook event deduplication
-- ============================================
CREATE OR REPLACE FUNCTION public.is_webhook_event_processed(p_stripe_event_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.stripe_webhook_events
    WHERE stripe_event_id = p_stripe_event_id
  );
END;
$$;

COMMENT ON FUNCTION public.is_webhook_event_processed IS 'Check if webhook event has already been processed (prevents replay attacks)';
