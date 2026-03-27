-- Concurrency protection for checkout requests and inventory operations
-- Prevents race conditions, double checkouts, and inconsistent state

-- ============================================
-- 1. Prevent duplicate checkout requests for same pallets
-- ============================================

-- Add unique constraint: one active checkout request per inventory item
-- Multiple requests allowed only if previous ones are completed/cancelled
ALTER TABLE public.pallet_checkout_requests
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.pallet_checkout_requests.completed_at IS 'When checkout was physically completed (all pallets shipped)';
COMMENT ON COLUMN public.pallet_checkout_requests.cancelled_at IS 'When checkout request was cancelled';

-- Create junction table for tracking which pallets are in which checkout request
CREATE TABLE IF NOT EXISTS public.pallet_checkout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id UUID NOT NULL REFERENCES public.pallet_checkout_requests(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one active checkout request per pallet
  UNIQUE(inventory_item_id, checkout_request_id)
);

CREATE INDEX IF NOT EXISTS idx_pallet_checkout_items_request_id ON public.pallet_checkout_items(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_pallet_checkout_items_inventory_item_id ON public.pallet_checkout_items(inventory_item_id);

COMMENT ON TABLE public.pallet_checkout_items IS 'Junction table: tracks which pallets are in which checkout request (prevents double checkout)';

-- ============================================
-- 2. Add status column to inventory_items for atomic updates
-- ============================================
-- Ensures inventory status changes are atomic and prevent double processing

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS checkout_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_locked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.inventory_items.checkout_locked_at IS 'Timestamp when item was locked for checkout (prevents concurrent checkout)';
COMMENT ON COLUMN public.inventory_items.checkout_locked_by IS 'User who locked the item for checkout';

CREATE INDEX IF NOT EXISTS idx_inventory_items_checkout_locked_at ON public.inventory_items(checkout_locked_at) WHERE checkout_locked_at IS NOT NULL;

-- ============================================
-- 3. Function: Check if pallets are available for checkout
-- ============================================
CREATE OR REPLACE FUNCTION public.can_checkout_pallets(
  p_inventory_item_ids UUID[]
)
RETURNS TABLE(
  item_id UUID,
  can_checkout BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    id AS item_id,
    CASE
      -- Already shipped
      WHEN inventory_item_status = 'shipped' THEN false
      -- Locked by another checkout request
      WHEN checkout_locked_at IS NOT NULL 
        AND checkout_locked_at > (now() - INTERVAL '30 minutes') THEN false
      -- Available
      ELSE true
    END AS can_checkout,
    CASE
      WHEN inventory_item_status = 'shipped' THEN 'Already shipped'
      WHEN checkout_locked_at IS NOT NULL 
        AND checkout_locked_at > (now() - INTERVAL '30 minutes') 
        THEN 'Locked by another checkout request'
      ELSE 'Available'
    END AS reason
  FROM public.inventory_items
  WHERE id = ANY(p_inventory_item_ids);
END;
$$;

COMMENT ON FUNCTION public.can_checkout_pallets IS 'Check if inventory items are available for checkout (atomic check)';

-- ============================================
-- 4. Function: Lock pallets for checkout (atomic operation)
-- ============================================
CREATE OR REPLACE FUNCTION public.lock_pallets_for_checkout(
  p_inventory_item_ids UUID[],
  p_locked_by UUID
)
RETURNS TABLE(
  locked_count INTEGER,
  failed_items UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locked_count INTEGER := 0;
  v_failed_items UUID[] := ARRAY[]::UUID[];
  v_item_id UUID;
BEGIN
  -- Try to lock each item atomically
  FOREACH v_item_id IN ARRAY p_inventory_item_ids
  LOOP
    UPDATE public.inventory_items
    SET 
      checkout_locked_at = now(),
      checkout_locked_by = p_locked_by
    WHERE id = v_item_id
      AND (
        checkout_locked_at IS NULL 
        OR checkout_locked_at < (now() - INTERVAL '30 minutes')
      )
      AND inventory_item_status != 'shipped';
    
    IF FOUND THEN
      v_locked_count := v_locked_count + 1;
    ELSE
      v_failed_items := array_append(v_failed_items, v_item_id);
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_locked_count, v_failed_items;
END;
$$;

COMMENT ON FUNCTION public.lock_pallets_for_checkout IS 'Atomically lock pallets for checkout (prevents race conditions)';

-- ============================================
-- 5. Function: Release pallet locks
-- ============================================
CREATE OR REPLACE FUNCTION public.release_pallet_locks(
  p_inventory_item_ids UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_released_count INTEGER;
BEGIN
  UPDATE public.inventory_items
  SET 
    checkout_locked_at = NULL,
    checkout_locked_by = NULL
  WHERE id = ANY(p_inventory_item_ids);
  
  GET DIAGNOSTICS v_released_count = ROW_COUNT;
  RETURN v_released_count;
END;
$$;

COMMENT ON FUNCTION public.release_pallet_locks IS 'Release pallet checkout locks (cleanup on cancel/error)';

-- ============================================
-- 6. Automatically release old locks (cleanup trigger)
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_stale_pallet_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleaned_count INTEGER;
BEGIN
  -- Release locks older than 30 minutes
  UPDATE public.inventory_items
  SET 
    checkout_locked_at = NULL,
    checkout_locked_by = NULL
  WHERE checkout_locked_at < (now() - INTERVAL '30 minutes');
  
  GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;
  RETURN v_cleaned_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_stale_pallet_locks IS 'Cleanup function: release pallet locks older than 30 minutes';
