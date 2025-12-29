-- Migration: Add available capacity tracking columns
-- Description: Add available_pallet_storage and available_sq_ft columns to track real-time availability
-- Created: 2025-12-29

-- Add available capacity columns
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS available_pallet_storage INTEGER,
ADD COLUMN IF NOT EXISTS available_sq_ft INTEGER;

-- Initialize available capacity with total capacity for existing warehouses
UPDATE warehouses
SET available_pallet_storage = total_pallet_storage
WHERE available_pallet_storage IS NULL;

UPDATE warehouses
SET available_sq_ft = total_sq_ft
WHERE available_sq_ft IS NULL;

-- Add comments
COMMENT ON COLUMN warehouses.available_pallet_storage IS 'Current available pallet storage capacity (updated when bookings are confirmed/cancelled)';
COMMENT ON COLUMN warehouses.available_sq_ft IS 'Current available square footage (updated when bookings are confirmed/cancelled)';

-- Create function to update warehouse availability when booking status changes
CREATE OR REPLACE FUNCTION update_warehouse_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- When booking is confirmed (status changes to confirmed or active)
  IF (TG_OP = 'INSERT' AND NEW.booking_status IN ('confirmed', 'active')) OR
     (TG_OP = 'UPDATE' AND OLD.booking_status IN ('pending', 'payment_pending') AND NEW.booking_status IN ('confirmed', 'active')) THEN

    -- Reduce available capacity for pallet bookings
    IF NEW.type = 'pallet' AND NEW.pallet_count IS NOT NULL THEN
      UPDATE warehouses
      SET available_pallet_storage = GREATEST(0, COALESCE(available_pallet_storage, 0) - NEW.pallet_count)
      WHERE id = NEW.warehouse_id;
    END IF;

    -- Reduce available capacity for area rental bookings
    IF NEW.type = 'area-rental' AND NEW.area_sq_ft IS NOT NULL THEN
      UPDATE warehouses
      SET available_sq_ft = GREATEST(0, COALESCE(available_sq_ft, 0) - NEW.area_sq_ft)
      WHERE id = NEW.warehouse_id;
    END IF;

  -- When booking is cancelled (status changes to cancelled)
  ELSIF TG_OP = 'UPDATE' AND OLD.booking_status IN ('confirmed', 'active') AND NEW.booking_status = 'cancelled' THEN

    -- Restore available capacity for pallet bookings
    IF NEW.type = 'pallet' AND NEW.pallet_count IS NOT NULL THEN
      UPDATE warehouses
      SET available_pallet_storage = LEAST(
        COALESCE(total_pallet_storage, 0),
        COALESCE(available_pallet_storage, 0) + NEW.pallet_count
      )
      WHERE id = NEW.warehouse_id;
    END IF;

    -- Restore available capacity for area rental bookings
    IF NEW.type = 'area-rental' AND NEW.area_sq_ft IS NOT NULL THEN
      UPDATE warehouses
      SET available_sq_ft = LEAST(
        COALESCE(total_sq_ft, 0),
        COALESCE(available_sq_ft, 0) + NEW.area_sq_ft
      )
      WHERE id = NEW.warehouse_id;
    END IF;

  -- When booking is completed and end date has passed
  ELSIF TG_OP = 'UPDATE' AND OLD.booking_status IN ('active') AND NEW.booking_status = 'completed' THEN

    -- Restore available capacity for pallet bookings
    IF NEW.type = 'pallet' AND NEW.pallet_count IS NOT NULL THEN
      UPDATE warehouses
      SET available_pallet_storage = LEAST(
        COALESCE(total_pallet_storage, 0),
        COALESCE(available_pallet_storage, 0) + NEW.pallet_count
      )
      WHERE id = NEW.warehouse_id;
    END IF;

    -- Restore available capacity for area rental bookings
    IF NEW.type = 'area-rental' AND NEW.area_sq_ft IS NOT NULL THEN
      UPDATE warehouses
      SET available_sq_ft = LEAST(
        COALESCE(total_sq_ft, 0),
        COALESCE(available_sq_ft, 0) + NEW.area_sq_ft
      )
      WHERE id = NEW.warehouse_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update availability
DROP TRIGGER IF EXISTS trigger_update_warehouse_availability ON bookings;
CREATE TRIGGER trigger_update_warehouse_availability
  AFTER INSERT OR UPDATE OF booking_status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_warehouse_availability();

-- Add check constraint to prevent negative availability
ALTER TABLE warehouses
ADD CONSTRAINT check_available_pallet_storage_non_negative
CHECK (available_pallet_storage IS NULL OR available_pallet_storage >= 0);

ALTER TABLE warehouses
ADD CONSTRAINT check_available_sq_ft_non_negative
CHECK (available_sq_ft IS NULL OR available_sq_ft >= 0);
