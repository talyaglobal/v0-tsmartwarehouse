-- TSmart Warehouse Management System - Enhance Inventory Tracking
-- Add tracking numbers, lot/batch numbers, duration fields, and region support
-- Generated: December 2024

-- ============================================
-- ADD TRACKING FIELDS TO INVENTORY_ITEMS
-- ============================================

-- Warehouse tracking number (unique identifier)
ALTER TABLE inventory_items 
  ADD COLUMN IF NOT EXISTS warehouse_tracking_number TEXT UNIQUE;

-- Customer lot and batch numbers
ALTER TABLE inventory_items 
  ADD COLUMN IF NOT EXISTS customer_lot_number TEXT,
  ADD COLUMN IF NOT EXISTS customer_batch_number TEXT;

-- Region support
ALTER TABLE inventory_items 
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES warehouse_regions(id) ON DELETE SET NULL;

-- Received date (for duration calculation)
ALTER TABLE inventory_items 
  ADD COLUMN IF NOT EXISTS received_date DATE;

-- Duration fields (calculated)
ALTER TABLE inventory_items 
  ADD COLUMN IF NOT EXISTS days_in_warehouse INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS months_in_warehouse DECIMAL(10, 2) DEFAULT 0;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_inventory_items_warehouse_tracking_number ON inventory_items(warehouse_tracking_number);
CREATE INDEX IF NOT EXISTS idx_inventory_items_customer_lot_number ON inventory_items(customer_lot_number);
CREATE INDEX IF NOT EXISTS idx_inventory_items_customer_batch_number ON inventory_items(customer_batch_number);
CREATE INDEX IF NOT EXISTS idx_inventory_items_region_id ON inventory_items(region_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_received_date ON inventory_items(received_date);

-- ============================================
-- FUNCTION: Generate Warehouse Tracking Number
-- ============================================
CREATE OR REPLACE FUNCTION generate_warehouse_tracking_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  tracking_num TEXT;
BEGIN
  -- Get current year
  year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get next sequence number for this year
  -- Create sequence if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'warehouse_tracking_seq_' || year_part) THEN
    EXECUTE format('CREATE SEQUENCE warehouse_tracking_seq_%s START 1', year_part);
  END IF;
  
  -- Get next value from sequence
  EXECUTE format('SELECT nextval(''warehouse_tracking_seq_%s'')', year_part) INTO seq_num;
  
  -- Format: WH-YYYY-NNNNNN (6 digits)
  tracking_num := 'WH-' || year_part || '-' || LPAD(seq_num::TEXT, 6, '0');
  
  RETURN tracking_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Calculate Storage Duration
-- ============================================
CREATE OR REPLACE FUNCTION calculate_storage_duration(item_received_date DATE)
RETURNS TABLE(days INTEGER, months DECIMAL) AS $$
BEGIN
  IF item_received_date IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, 0::DECIMAL;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    (CURRENT_DATE - item_received_date)::INTEGER AS days,
    ROUND((CURRENT_DATE - item_received_date)::DECIMAL / 30.0, 2) AS months;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-generate tracking number on insert
-- ============================================
CREATE OR REPLACE FUNCTION generate_tracking_number_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.warehouse_tracking_number IS NULL OR NEW.warehouse_tracking_number = '' THEN
    NEW.warehouse_tracking_number := generate_warehouse_tracking_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_tracking_number_trigger
  BEFORE INSERT ON inventory_items
  FOR EACH ROW
  WHEN (NEW.warehouse_tracking_number IS NULL OR NEW.warehouse_tracking_number = '')
  EXECUTE FUNCTION generate_tracking_number_trigger();

-- ============================================
-- TRIGGER: Update duration when received_date changes
-- ============================================
CREATE OR REPLACE FUNCTION update_inventory_duration()
RETURNS TRIGGER AS $$
DECLARE
  duration_result RECORD;
BEGIN
  IF NEW.received_date IS NOT NULL THEN
    SELECT * INTO duration_result FROM calculate_storage_duration(NEW.received_date);
    NEW.days_in_warehouse := duration_result.days;
    NEW.months_in_warehouse := duration_result.months;
  ELSE
    NEW.days_in_warehouse := 0;
    NEW.months_in_warehouse := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_duration_trigger
  BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_duration();

-- ============================================
-- TRIGGER: Set received_date from received_at if not set
-- ============================================
CREATE OR REPLACE FUNCTION set_received_date_from_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- If received_date is not set but received_at is, extract date
  IF NEW.received_date IS NULL AND NEW.received_at IS NOT NULL THEN
    NEW.received_date := NEW.received_at::DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_received_date_trigger
  BEFORE INSERT OR UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION set_received_date_from_timestamp();

