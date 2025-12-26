-- TSmart Warehouse Management System - Pallet Label Fields
-- Add label-specific fields for full traceability
-- Generated: December 2024

-- ============================================
-- ADD LABEL FIELDS TO INVENTORY_ITEMS
-- ============================================

-- Expected release date
ALTER TABLE inventory_items 
  ADD COLUMN IF NOT EXISTS expected_release_date DATE;

-- Stock definition/description
ALTER TABLE inventory_items 
  ADD COLUMN IF NOT EXISTS stock_definition TEXT;

-- Cases and units
ALTER TABLE inventory_items 
  ADD COLUMN IF NOT EXISTS number_of_cases INTEGER,
  ADD COLUMN IF NOT EXISTS number_of_units INTEGER,
  ADD COLUMN IF NOT EXISTS unit_type TEXT;

-- HS code (Harmonized System code for customs)
ALTER TABLE inventory_items 
  ADD COLUMN IF NOT EXISTS hs_code TEXT;

-- Storage requirements (array)
ALTER TABLE inventory_items 
  ADD COLUMN IF NOT EXISTS storage_requirements TEXT[];

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_inventory_items_expected_release_date ON inventory_items(expected_release_date);
CREATE INDEX IF NOT EXISTS idx_inventory_items_hs_code ON inventory_items(hs_code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_storage_requirements ON inventory_items USING GIN(storage_requirements);

-- ============================================
-- TRIGGER: Auto-update expected release date from booking
-- ============================================
CREATE OR REPLACE FUNCTION update_expected_release_date_trigger()
RETURNS TRIGGER AS $$
DECLARE
  booking_end_date DATE;
BEGIN
  -- If expected_release_date is not manually set, try to get it from booking
  IF NEW.expected_release_date IS NULL AND NEW.booking_id IS NOT NULL THEN
    SELECT end_date INTO booking_end_date
    FROM bookings
    WHERE id = NEW.booking_id;
    
    IF booking_end_date IS NOT NULL THEN
      NEW.expected_release_date := booking_end_date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_expected_release_date_trigger
  BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_expected_release_date_trigger();

