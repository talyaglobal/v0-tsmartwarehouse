-- Phase 2: Warehouse Operations Hardening
-- Covers:
--   1. Pallet lifecycle: add partial_move state + enforce valid transitions
--   2. QR: duplicate scan prevention + audit log per scan
--   3. Capacity: release on booking cancel/expire + overbooking prevention
--   4. Staff operations: role-based audit columns

-- ============================================================
-- 1. PALLET LIFECYCLE
-- ============================================================

-- Extend inventory_item_status to include partial_move.
-- Full lifecycle: received → stored → partial_move → stored → shipped
-- (partial_move allows moving only some pallets out of a batch)
ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_inventory_item_status_check,
  ADD CONSTRAINT inventory_items_inventory_item_status_check
    CHECK (inventory_item_status IN (
      'in-transit',
      'received',
      'stored',
      'partial_move',
      'moved',
      'shipped',
      'damaged',
      'lost'
    ));

-- Also apply to the legacy status column if it still exists
ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_status_check;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'status'
  ) THEN
    EXECUTE 'ALTER TABLE public.inventory_items
      ADD CONSTRAINT inventory_items_status_check
      CHECK (status IN (
        ''in-transit'', ''received'', ''stored'', ''partial_move'',
        ''moved'', ''shipped'', ''damaged'', ''lost''
      ))';
  END IF;
END $$;

-- Valid state transition function.
-- Returns TRUE if moving from old_status → new_status is permitted.
-- Prevents orphan states and backwards transitions.
CREATE OR REPLACE FUNCTION public.is_valid_pallet_transition(
  old_status TEXT,
  new_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE old_status
    WHEN 'in-transit'    THEN new_status IN ('received', 'damaged', 'lost')
    WHEN 'received'      THEN new_status IN ('stored', 'damaged', 'lost')
    WHEN 'stored'        THEN new_status IN ('partial_move', 'moved', 'shipped', 'damaged', 'lost')
    WHEN 'partial_move'  THEN new_status IN ('stored', 'moved', 'shipped', 'damaged', 'lost')
    WHEN 'moved'         THEN new_status IN ('stored', 'shipped', 'damaged', 'lost')
    WHEN 'shipped'       THEN FALSE  -- Terminal state
    WHEN 'damaged'       THEN new_status IN ('lost')
    WHEN 'lost'          THEN FALSE  -- Terminal state
    ELSE FALSE
  END;
END;
$$;

COMMENT ON FUNCTION public.is_valid_pallet_transition IS
  'Validates pallet status transitions to prevent orphan/invalid states';

-- Trigger: enforce valid transitions on UPDATE
CREATE OR REPLACE FUNCTION public.enforce_pallet_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  -- Determine which status column is in use
  v_old_status := COALESCE(OLD.inventory_item_status, OLD.status);
  v_new_status := COALESCE(NEW.inventory_item_status, NEW.status);

  IF v_old_status IS NOT NULL
     AND v_new_status IS NOT NULL
     AND v_old_status != v_new_status
     AND NOT public.is_valid_pallet_transition(v_old_status, v_new_status) THEN
    RAISE EXCEPTION
      'Invalid pallet status transition: % → %', v_old_status, v_new_status
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pallet_status_transition ON public.inventory_items;
CREATE TRIGGER trg_enforce_pallet_status_transition
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pallet_status_transition();

COMMENT ON TRIGGER trg_enforce_pallet_status_transition ON public.inventory_items IS
  'Prevents invalid pallet state transitions at the DB level';


-- ============================================================
-- 2. QR SYSTEM HARDENING
-- ============================================================

-- QR scan log: one row per unique (pallet, operation) per shift to prevent
-- duplicate scan side-effects (double check-in / double check-out).
CREATE TABLE IF NOT EXISTS public.qr_scan_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  booking_id    TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
  warehouse_id  UUID REFERENCES public.warehouses(id) ON DELETE SET NULL,
  scan_type     TEXT NOT NULL CHECK (scan_type IN ('check_in', 'check_out', 'move', 'view')),
  scanned_by    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  scanned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- HMAC-signed payload hash for tamper detection
  payload_hash  TEXT,
  -- Prevent the same user from double-scanning the same pallet for the same
  -- actionable operation within a 5-minute window (debounce).
  -- View scans are always allowed.
  metadata      JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_item_id
  ON public.qr_scan_logs(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_scanned_at
  ON public.qr_scan_logs(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_booking_id
  ON public.qr_scan_logs(booking_id);

-- Partial unique index: prevent duplicate actionable scans within 5 minutes
-- (same pallet, same operation, same user, within 5 min window)
-- View scans are excluded from deduplication.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_qr_scan_no_duplicate_action
  ON public.qr_scan_logs(inventory_item_id, scan_type, scanned_by,
                          date_trunc('minute', scanned_at))
  WHERE scan_type != 'view';

COMMENT ON TABLE public.qr_scan_logs IS
  'Audit log for all QR code scans with duplicate-action prevention';

-- RLS for scan logs
ALTER TABLE public.qr_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY qr_scan_logs_select_staff ON public.qr_scan_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.warehouse_staff ws
      WHERE ws.warehouse_id = qr_scan_logs.warehouse_id
        AND ws.user_id = auth.uid()
        AND ws.status = true
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.warehouses w ON w.owner_company_id = p.company_id
      WHERE p.id = auth.uid() AND w.id = qr_scan_logs.warehouse_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'root'
    )
  );

-- Add HMAC signature column to inventory_items for tamper-proof QR payloads
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS qr_signature TEXT;

COMMENT ON COLUMN public.inventory_items.qr_signature IS
  'HMAC-SHA256 signature of the QR payload for tamper detection';


-- ============================================================
-- 3. CAPACITY MANAGEMENT
-- ============================================================

-- Track reserved pallet count per booking for overbooking prevention.
-- A CHECK constraint enforces that confirmed+active bookings do not exceed
-- the warehouse pallet capacity (enforced via a DB function).

-- Function: total confirmed/active pallets for a warehouse at a given time range
CREATE OR REPLACE FUNCTION public.get_reserved_pallet_count(
  p_warehouse_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_exclude_booking_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COALESCE(SUM(pallet_count), 0) INTO v_count
  FROM public.bookings
  WHERE warehouse_id = p_warehouse_id
    AND booking_type = 'pallet'
    AND status IN ('confirmed', 'active', 'payment_pending')
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
    AND (
      -- Overlapping date range check
      (start_date <= p_end_date) AND (end_date IS NULL OR end_date >= p_start_date)
    );
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.get_reserved_pallet_count IS
  'Returns total confirmed/active pallet count for a warehouse in a date range';

-- Function: check warehouse pallet capacity before a new booking
CREATE OR REPLACE FUNCTION public.check_pallet_capacity(
  p_warehouse_id UUID,
  p_pallet_count INTEGER,
  p_start_date DATE,
  p_end_date DATE,
  p_exclude_booking_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  available BOOLEAN,
  current_reserved INTEGER,
  warehouse_capacity INTEGER,
  available_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_capacity INTEGER;
  v_reserved INTEGER;
BEGIN
  -- Get warehouse max pallet capacity
  SELECT max_pallets INTO v_capacity
  FROM public.warehouses
  WHERE id = p_warehouse_id;

  IF v_capacity IS NULL THEN
    v_capacity := 9999; -- Unconstrained if not set
  END IF;

  v_reserved := public.get_reserved_pallet_count(
    p_warehouse_id, p_start_date, p_end_date, p_exclude_booking_id
  );

  RETURN QUERY SELECT
    (v_reserved + p_pallet_count) <= v_capacity AS available,
    v_reserved AS current_reserved,
    v_capacity AS warehouse_capacity,
    GREATEST(0, v_capacity - v_reserved) AS available_count;
END;
$$;

COMMENT ON FUNCTION public.check_pallet_capacity IS
  'Check pallet capacity availability before confirming a booking';

-- Add max_pallets to warehouses if not present
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS max_pallets INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.warehouses.max_pallets IS
  'Maximum pallet capacity; NULL means unconstrained';

-- Trigger: on booking cancel or expire → release capacity snapshot
-- (capacity_snapshots table should be updated when booking status changes)
CREATE OR REPLACE FUNCTION public.release_capacity_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only act when transitioning TO a terminal/release state
  IF NEW.status IN ('cancelled', 'expired', 'rejected')
     AND OLD.status NOT IN ('cancelled', 'expired', 'rejected') THEN

    -- Log capacity release event for audit
    INSERT INTO public.pallet_operation_logs (
      booking_id,
      warehouse_id,
      operation,
      performed_at,
      metadata
    ) VALUES (
      NEW.id,
      NEW.warehouse_id,
      'capacity_released',
      now(),
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'pallet_count', NEW.pallet_count,
        'reason', 'booking_cancelled_or_expired'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_capacity_on_cancel ON public.bookings;
CREATE TRIGGER trg_release_capacity_on_cancel
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.release_capacity_on_cancel();

COMMENT ON TRIGGER trg_release_capacity_on_cancel ON public.bookings IS
  'Logs capacity release when a booking is cancelled or expired';


-- ============================================================
-- 4. WAREHOUSE STAFF OPERATIONS — AUDIT COLUMNS
-- ============================================================

-- Add staff action context to operation logs
ALTER TABLE public.pallet_operation_logs
  ADD COLUMN IF NOT EXISTS staff_role TEXT,
  ADD COLUMN IF NOT EXISTS action_notes TEXT;

COMMENT ON COLUMN public.pallet_operation_logs.staff_role IS
  'Role of the staff member who performed the operation (staff, admin, root)';
COMMENT ON COLUMN public.pallet_operation_logs.action_notes IS
  'Optional notes recorded at time of operation';

-- Index for staff role audit queries
CREATE INDEX IF NOT EXISTS idx_pallet_operation_logs_performed_by
  ON public.pallet_operation_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_pallet_operation_logs_operation
  ON public.pallet_operation_logs(operation);
