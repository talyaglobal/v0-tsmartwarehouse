-- Create warehouse services and service orders tables
-- TSmart Warehouse Management System - Services & Orders
-- Generated: December 2024

-- ============================================
-- WAREHOUSE SERVICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS warehouse_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'receiving',
    'putaway',
    'picking',
    'shipping',
    'repalletization',
    'labeling',
    'inventory',
    'cross-docking',
    'kitting',
    'returns',
    'quality-control',
    'temperature-control',
    'hazmat',
    'custom-packaging',
    'other'
  )),
  unit_type TEXT NOT NULL CHECK (unit_type IN ('per-item', 'per-pallet', 'per-hour', 'per-order', 'flat-rate')),
  base_price DECIMAL(10, 2) NOT NULL,
  min_quantity INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_services_category ON warehouse_services(category);
CREATE INDEX IF NOT EXISTS idx_warehouse_services_active ON warehouse_services(is_active);
CREATE INDEX IF NOT EXISTS idx_warehouse_services_code ON warehouse_services(code);

-- ============================================
-- SERVICE ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN (
    'draft',
    'pending',
    'confirmed',
    'in-progress',
    'completed',
    'cancelled'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  requested_date DATE,
  due_date DATE,
  completed_date DATE,
  notes TEXT,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_customer_id ON service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_booking_id ON service_orders(booking_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_order_number ON service_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_service_orders_due_date ON service_orders(due_date);

-- ============================================
-- SERVICE ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS service_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES warehouse_services(id) ON DELETE RESTRICT,
  service_name TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_order_items_order_id ON service_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_service_order_items_service_id ON service_order_items(service_id);
CREATE INDEX IF NOT EXISTS idx_service_order_items_status ON service_order_items(status);

-- ============================================
-- UPDATE INVOICES TABLE
-- ============================================
ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS service_order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_service_order_id ON invoices(service_order_id);

-- ============================================
-- FUNCTION TO GENERATE ORDER NUMBER
-- ============================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT COUNT(*) INTO exists_check FROM service_orders WHERE order_number = new_number;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER TO AUTO-GENERATE ORDER NUMBER
-- ============================================
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- ============================================
-- TRIGGERS TO UPDATE UPDATED_AT
-- ============================================
CREATE TRIGGER trigger_update_service_orders_updated_at
  BEFORE UPDATE ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_service_order_items_updated_at
  BEFORE UPDATE ON service_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_warehouse_services_updated_at
  BEFORE UPDATE ON warehouse_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE warehouse_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR WAREHOUSE_SERVICES
-- ============================================
-- Public read access to active services
CREATE POLICY "Public can view active services"
  ON warehouse_services FOR SELECT
  USING (is_active = true);

-- Admins can manage all services
CREATE POLICY "Admins can manage all services"
  ON warehouse_services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR SERVICE_ORDERS
-- ============================================
-- Customers can view their own orders
CREATE POLICY "Customers can view own orders"
  ON service_orders FOR SELECT
  USING (
    customer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Customers can create their own orders
CREATE POLICY "Customers can create own orders"
  ON service_orders FOR INSERT
  WITH CHECK (
    customer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Customers can update their own orders (only draft/pending status)
CREATE POLICY "Customers can update own orders"
  ON service_orders FOR UPDATE
  USING (
    (customer_id = auth.uid() AND status IN ('draft', 'pending')) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    (customer_id = auth.uid() AND status IN ('draft', 'pending')) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update all orders
CREATE POLICY "Admins can update all orders"
  ON service_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can delete orders
CREATE POLICY "Admins can delete orders"
  ON service_orders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR SERVICE_ORDER_ITEMS
-- ============================================
-- Users can view items for orders they have access to
CREATE POLICY "Users can view accessible order items"
  ON service_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_orders.id = service_order_items.order_id
      AND (
        service_orders.customer_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  );

-- Admins can manage all order items
CREATE POLICY "Admins can manage all order items"
  ON service_order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- INSERT DEFAULT SERVICES (SEED DATA)
-- ============================================
INSERT INTO warehouse_services (code, name, description, category, unit_type, base_price) VALUES
  ('REC-001', 'Receiving & Unloading', 'Unload and receive incoming shipments with inspection and documentation', 'receiving', 'per-pallet', 15.00),
  ('PUT-001', 'Putaway Service', 'Place items in designated warehouse locations', 'putaway', 'per-pallet', 12.00),
  ('PIC-001', 'Order Picking', 'Pick items for orders from warehouse locations', 'picking', 'per-item', 2.50),
  ('SHI-001', 'Shipping & Labeling', 'Prepare shipments with proper labeling and documentation', 'shipping', 'per-order', 25.00),
  ('REP-001', 'Repalletization', 'Rebuild and secure pallets with stretch wrapping', 'repalletization', 'per-pallet', 20.00),
  ('LAB-001', 'Custom Labeling', 'Create and apply custom labels or barcodes', 'labeling', 'per-item', 1.50),
  ('INV-001', 'Inventory Count', 'Cycle count and inventory audit services', 'inventory', 'per-hour', 50.00),
  ('KIT-001', 'Kitting & Assembly', 'Assemble products and create custom kits', 'kitting', 'per-item', 5.00),
  ('RET-001', 'Returns Processing', 'Process returned items including inspection and restocking', 'returns', 'per-item', 8.00),
  ('QC-001', 'Quality Control Inspection', 'Inspect and test products for quality assurance', 'quality-control', 'per-item', 3.00)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE warehouse_services IS 'Catalog of available warehouse value-added services';
COMMENT ON TABLE service_orders IS 'Customer orders for warehouse services';
COMMENT ON TABLE service_order_items IS 'Line items for service orders';
COMMENT ON COLUMN warehouse_services.code IS 'Unique service code identifier';
COMMENT ON COLUMN service_orders.order_number IS 'Auto-generated unique order number format: ORD-YYYYMMDD-XXXX';
COMMENT ON COLUMN service_orders.total_amount IS 'Total amount calculated from order items';

