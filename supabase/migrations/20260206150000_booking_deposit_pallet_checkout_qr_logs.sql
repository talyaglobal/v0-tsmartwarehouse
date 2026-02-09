-- Booking deposit, pallet checkout requests, check-in/check-out photos, and pallet operation logs
-- Implements: 10% deposit on booking; checkout request with proportional payment; 3 photos at check-in/check-out; QR scan logging

-- ============================================
-- 1. Bookings: deposit fields
-- ============================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.deposit_amount IS '10% deposit amount (of total_amount)';
COMMENT ON COLUMN public.bookings.deposit_paid_at IS 'When deposit was paid (Stripe success)';

CREATE INDEX IF NOT EXISTS idx_bookings_deposit_paid_at ON public.bookings(deposit_paid_at) WHERE deposit_paid_at IS NOT NULL;

-- ============================================
-- 2. Pallet checkout requests (remaining payment per checkout)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pallet_checkout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  pallet_count INTEGER NOT NULL CHECK (pallet_count > 0),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'completed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pallet_checkout_requests_booking_id ON public.pallet_checkout_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_pallet_checkout_requests_warehouse_id ON public.pallet_checkout_requests(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pallet_checkout_requests_customer_id ON public.pallet_checkout_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_pallet_checkout_requests_status ON public.pallet_checkout_requests(status);

COMMENT ON TABLE public.pallet_checkout_requests IS 'Check-out payment request: remaining amount (proportional) must be paid before pallet check-out';

-- ============================================
-- 3. Pallet check-in photos (min 3: sealed, opened_emptying, empty)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pallet_checkin_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('sealed', 'opened_emptying', 'empty')),
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_pallet_checkin_photos_inventory_item_id ON public.pallet_checkin_photos(inventory_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pallet_checkin_photos_item_type ON public.pallet_checkin_photos(inventory_item_id, photo_type);

COMMENT ON TABLE public.pallet_checkin_photos IS 'Required 3 photos per pallet at check-in: sealed, opened_emptying, empty';

-- ============================================
-- 4. Pallet check-out photos (min 3 at exit)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pallet_checkout_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_checkout_request_id UUID NOT NULL REFERENCES public.pallet_checkout_requests(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('before_exit', 'loading', 'empty_area')),
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_pallet_checkout_photos_request_id ON public.pallet_checkout_photos(pallet_checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_pallet_checkout_photos_inventory_item_id ON public.pallet_checkout_photos(inventory_item_id);

COMMENT ON TABLE public.pallet_checkout_photos IS 'Required 3 photos per check-out: before_exit, loading, empty_area';

-- ============================================
-- 5. Pallet operation logs (every QR scan)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pallet_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL CHECK (operation IN ('check_in', 'check_out', 'move', 'scan_view')),
  performed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pallet_operation_logs_inventory_item_id ON public.pallet_operation_logs(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_pallet_operation_logs_booking_id ON public.pallet_operation_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_pallet_operation_logs_warehouse_id ON public.pallet_operation_logs(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_pallet_operation_logs_performed_at ON public.pallet_operation_logs(performed_at);
CREATE INDEX IF NOT EXISTS idx_pallet_operation_logs_operation ON public.pallet_operation_logs(operation);

COMMENT ON TABLE public.pallet_operation_logs IS 'Log entry for every QR scan / pallet operation';

-- ============================================
-- 6. Payments: optional link to checkout request (for deposit use booking_id + metadata)
-- ============================================
-- Payments table has invoice_id; deposit can use a dedicated invoice or metadata. Add optional checkout_request_id if payments table allows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables t
    JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE t.table_schema = 'public' AND t.table_name = 'payments'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'booking_id'
    ) THEN
      ALTER TABLE public.payments ADD COLUMN booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'checkout_request_id'
    ) THEN
      ALTER TABLE public.payments ADD COLUMN checkout_request_id UUID REFERENCES public.pallet_checkout_requests(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_type'
    ) THEN
      ALTER TABLE public.payments ADD COLUMN payment_type TEXT DEFAULT 'invoice' CHECK (payment_type IN ('invoice', 'deposit', 'checkout_remaining'));
    END IF;
  END IF;
END $$;

-- If payments references users(id), we may need to handle that. Skip if column doesn't exist.
-- (Existing schema uses users/id in some places; new tables use profiles.)

-- ============================================
-- 7. RLS for new tables
-- ============================================
ALTER TABLE public.pallet_checkout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pallet_checkin_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pallet_checkout_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pallet_operation_logs ENABLE ROW LEVEL SECURITY;

-- pallet_checkout_requests: customer sees own; warehouse staff/admin see for their warehouses
DROP POLICY IF EXISTS "pallet_checkout_requests_select_own" ON public.pallet_checkout_requests;
CREATE POLICY "pallet_checkout_requests_select_own" ON public.pallet_checkout_requests
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.warehouse_staff ws WHERE ws.warehouse_id = pallet_checkout_requests.warehouse_id AND ws.user_id = auth.uid() AND ws.status = true)
    OR EXISTS (SELECT 1 FROM public.warehouses w JOIN public.profiles p ON p.company_id = w.owner_company_id AND p.id = auth.uid() WHERE w.id = pallet_checkout_requests.warehouse_id)
  );

DROP POLICY IF EXISTS "pallet_checkout_requests_insert" ON public.pallet_checkout_requests;
CREATE POLICY "pallet_checkout_requests_insert" ON public.pallet_checkout_requests
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "pallet_checkout_requests_update" ON public.pallet_checkout_requests;
CREATE POLICY "pallet_checkout_requests_update" ON public.pallet_checkout_requests
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- pallet_checkin_photos: warehouse staff and customer (own booking)
DROP POLICY IF EXISTS "pallet_checkin_photos_select" ON public.pallet_checkin_photos;
CREATE POLICY "pallet_checkin_photos_select" ON public.pallet_checkin_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.inventory_items ii WHERE ii.id = inventory_item_id AND ii.customer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.inventory_items ii JOIN public.warehouse_staff ws ON ws.warehouse_id = ii.warehouse_id AND ws.user_id = auth.uid() AND ws.status = true WHERE ii.id = inventory_item_id)
    OR EXISTS (SELECT 1 FROM public.inventory_items ii JOIN public.warehouses w ON w.id = ii.warehouse_id JOIN public.profiles p ON p.company_id = w.owner_company_id AND p.id = auth.uid() WHERE ii.id = inventory_item_id)
  );

DROP POLICY IF EXISTS "pallet_checkin_photos_insert" ON public.pallet_checkin_photos;
CREATE POLICY "pallet_checkin_photos_insert" ON public.pallet_checkin_photos
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- pallet_checkout_photos: same as checkout_requests visibility
DROP POLICY IF EXISTS "pallet_checkout_photos_select" ON public.pallet_checkout_photos;
CREATE POLICY "pallet_checkout_photos_select" ON public.pallet_checkout_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.pallet_checkout_requests r WHERE r.id = pallet_checkout_request_id AND (r.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.warehouse_staff ws WHERE ws.warehouse_id = r.warehouse_id AND ws.user_id = auth.uid() AND ws.status = true)))
  );

DROP POLICY IF EXISTS "pallet_checkout_photos_insert" ON public.pallet_checkout_photos;
CREATE POLICY "pallet_checkout_photos_insert" ON public.pallet_checkout_photos
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- pallet_operation_logs: warehouse staff and customer (own booking)
DROP POLICY IF EXISTS "pallet_operation_logs_select" ON public.pallet_operation_logs;
CREATE POLICY "pallet_operation_logs_select" ON public.pallet_operation_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.customer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.warehouse_staff ws WHERE ws.warehouse_id = pallet_operation_logs.warehouse_id AND ws.user_id = auth.uid() AND ws.status = true)
    OR EXISTS (SELECT 1 FROM public.warehouses w JOIN public.profiles p ON p.company_id = w.owner_company_id AND p.id = auth.uid() WHERE w.id = pallet_operation_logs.warehouse_id)
  );

DROP POLICY IF EXISTS "pallet_operation_logs_insert" ON public.pallet_operation_logs;
CREATE POLICY "pallet_operation_logs_insert" ON public.pallet_operation_logs
  FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid());
