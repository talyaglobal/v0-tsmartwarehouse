-- TSmart Warehouse Management System - Inventory Schema
-- PostgreSQL Schema for Supabase
-- Generated: December 2024

-- ============================================
-- INVENTORY ITEMS (PALLETS) TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  floor_id UUID REFERENCES warehouse_floors(id) ON DELETE SET NULL,
  hall_id UUID REFERENCES warehouse_halls(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES warehouse_zones(id) ON DELETE SET NULL,
  
  -- Identification
  pallet_id TEXT UNIQUE NOT NULL, -- Barcode/QR code identifier
  barcode TEXT, -- Alternative barcode format
  qr_code TEXT, -- QR code data
  
  -- Item details
  description TEXT,
  item_type TEXT, -- e.g., "Electronics", "General", "Fragile"
  weight_kg DECIMAL(10, 2),
  dimensions JSONB, -- {length, width, height, unit}
  
  -- Location tracking
  location_code TEXT, -- e.g., "A2-Row 5-Level 3"
  row_number INTEGER,
  level_number INTEGER,
  
  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('in-transit', 'received', 'stored', 'moved', 'shipped', 'damaged', 'lost')),
  
  -- Movement tracking
  received_at TIMESTAMPTZ,
  stored_at TIMESTAMPTZ,
  last_moved_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_booking_id ON inventory_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_customer_id ON inventory_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_warehouse_id ON inventory_items(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_pallet_id ON inventory_items(pallet_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_barcode ON inventory_items(barcode);
CREATE INDEX IF NOT EXISTS idx_inventory_items_qr_code ON inventory_items(qr_code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_location_code ON inventory_items(location_code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_hall_id ON inventory_items(hall_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_zone_id ON inventory_items(zone_id);

-- ============================================
-- INVENTORY MOVEMENTS TABLE (AUDIT TRAIL)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  moved_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  moved_by_name TEXT NOT NULL,
  
  -- Movement details
  movement_type TEXT NOT NULL CHECK (movement_type IN ('received', 'stored', 'moved', 'shipped', 'returned', 'damaged')),
  from_location TEXT,
  to_location TEXT,
  from_location_code TEXT,
  to_location_code TEXT,
  
  -- Location references
  from_hall_id UUID REFERENCES warehouse_halls(id) ON DELETE SET NULL,
  to_hall_id UUID REFERENCES warehouse_halls(id) ON DELETE SET NULL,
  from_zone_id UUID REFERENCES warehouse_zones(id) ON DELETE SET NULL,
  to_zone_id UUID REFERENCES warehouse_zones(id) ON DELETE SET NULL,
  
  -- Metadata
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON inventory_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_moved_by ON inventory_movements(moved_by);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);

-- ============================================
-- TRIGGERS
-- ============================================
-- Auto-update updated_at timestamp
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be configured in 004_rls_policies.sql

