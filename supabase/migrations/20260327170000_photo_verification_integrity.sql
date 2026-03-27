-- Photo Verification: Enforce Required Photo Counts at DB Level
--
-- Ensures no inventory item can be marked 'stored' unless all 3 check-in photos
-- exist, and no checkout request can be completed unless all 3 checkout photos exist.
-- This is a backstop to the application-level Zod schema validation.

-- ============================================================
-- 1. Enforce checkin photos before status can advance past 'received'
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_checkin_photos_before_stored()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_photo_count INTEGER;
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  v_old_status := COALESCE(OLD.inventory_item_status, OLD.status);
  v_new_status := COALESCE(NEW.inventory_item_status, NEW.status);

  -- Only enforce when transitioning from 'received' → 'stored'
  IF v_old_status = 'received' AND v_new_status = 'stored' THEN
    SELECT COUNT(*) INTO v_photo_count
    FROM public.pallet_checkin_photos
    WHERE inventory_item_id = NEW.id;

    IF v_photo_count < 3 THEN
      RAISE EXCEPTION
        'Cannot mark pallet as stored: % of 3 required check-in photos are present (pallet: %)',
        v_photo_count, NEW.id
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_checkin_photos ON public.inventory_items;
CREATE TRIGGER trg_enforce_checkin_photos
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_checkin_photos_before_stored();

COMMENT ON TRIGGER trg_enforce_checkin_photos ON public.inventory_items IS
  'Prevents advancing pallet from received → stored without all 3 check-in photos';

-- ============================================================
-- 2. Enforce checkout photos before request can be marked completed
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_checkout_photos_before_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_photo_count INTEGER;
BEGIN
  -- Only enforce when transitioning to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT COUNT(*) INTO v_photo_count
    FROM public.pallet_checkout_photos
    WHERE pallet_checkout_request_id = NEW.id;

    IF v_photo_count < 3 THEN
      RAISE EXCEPTION
        'Cannot complete checkout request: % of 3 required checkout photos are present (request: %)',
        v_photo_count, NEW.id
        USING ERRCODE = 'P0003';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_checkout_photos ON public.pallet_checkout_requests;
CREATE TRIGGER trg_enforce_checkout_photos
  BEFORE UPDATE ON public.pallet_checkout_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_checkout_photos_before_complete();

COMMENT ON TRIGGER trg_enforce_checkout_photos ON public.pallet_checkout_requests IS
  'Prevents completing a checkout request without all 3 required checkout photos';

-- ============================================================
-- 3. Storage path integrity: non-empty paths (belt + suspenders)
-- ============================================================

ALTER TABLE public.pallet_checkin_photos
  ADD CONSTRAINT chk_checkin_photo_storage_path_nonempty
  CHECK (length(trim(storage_path)) > 0);

ALTER TABLE public.pallet_checkout_photos
  ADD CONSTRAINT chk_checkout_photo_storage_path_nonempty
  CHECK (length(trim(storage_path)) > 0);

COMMENT ON CONSTRAINT chk_checkin_photo_storage_path_nonempty ON public.pallet_checkin_photos IS
  'Prevents storing empty/whitespace-only storage paths';
COMMENT ON CONSTRAINT chk_checkout_photo_storage_path_nonempty ON public.pallet_checkout_photos IS
  'Prevents storing empty/whitespace-only storage paths';
