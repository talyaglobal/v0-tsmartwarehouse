-- TSmart Warehouse Management System - Access Logs Table
-- Tracks physical access (entry/exit) of people and vehicles at warehouse facilities
-- Generated: December 2024

-- ============================================
-- ACCESS LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Core Fields
  visitor_type TEXT NOT NULL CHECK (visitor_type IN ('vehicle', 'staff', 'customer', 'visitor', 'family_friend', 'delivery_driver', 'other')),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  entry_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'checked_out')),
  
  -- Person Details
  person_name TEXT NOT NULL,
  person_id_number TEXT, -- ID card/license number
  person_phone TEXT,
  person_email TEXT,
  company_name TEXT,
  person_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- If linked to a system user
  
  -- Vehicle Details (for vehicle/delivery types)
  vehicle_license_plate TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  vehicle_type TEXT CHECK (vehicle_type IN ('car', 'truck', 'van', 'motorcycle', 'suv', 'other')),
  
  -- Visit Details
  purpose TEXT, -- Purpose of visit
  authorized_by TEXT, -- Name of person authorizing the visit
  authorized_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- If authorized by system user
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL, -- If related to a booking
  notes TEXT,
  photo_url TEXT, -- URL to visitor/vehicle photo
  
  -- Metadata
  checked_in_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Staff member who checked in
  checked_out_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Staff member who checked out
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_access_logs_visitor_type ON access_logs(visitor_type);
CREATE INDEX IF NOT EXISTS idx_access_logs_warehouse_id ON access_logs(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_entry_time ON access_logs(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_status ON access_logs(status);
CREATE INDEX IF NOT EXISTS idx_access_logs_person_id ON access_logs(person_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_booking_id ON access_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_vehicle_license_plate ON access_logs(vehicle_license_plate);
CREATE INDEX IF NOT EXISTS idx_access_logs_person_name ON access_logs(person_name);
CREATE INDEX IF NOT EXISTS idx_access_logs_person_id_number ON access_logs(person_id_number);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_access_logs_type_warehouse_status ON access_logs(visitor_type, warehouse_id, status, entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_warehouse_date ON access_logs(warehouse_id, entry_time DESC);

-- ============================================
-- TRIGGERS: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_access_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_access_logs_updated_at
  BEFORE UPDATE ON access_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_access_logs_updated_at();

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Admins can view all access logs
CREATE POLICY "Admins can view all access logs"
  ON access_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Workers can view access logs for their warehouse
CREATE POLICY "Workers can view warehouse access logs"
  ON access_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'worker'
    )
  );

-- Admins and workers can create access logs (check-in)
CREATE POLICY "Staff can create access logs"
  ON access_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'worker')
    )
  );

-- Admins and workers can update access logs (check-out)
CREATE POLICY "Staff can update access logs"
  ON access_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'worker')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'worker')
    )
  );

-- Only admins can delete access logs
CREATE POLICY "Admins can delete access logs"
  ON access_logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE access_logs IS 'Tracks physical access (entry/exit) of people and vehicles at warehouse facilities';
COMMENT ON COLUMN access_logs.visitor_type IS 'Type of visitor: vehicle, staff, customer, visitor, family_friend, delivery_driver, other';
COMMENT ON COLUMN access_logs.status IS 'Current status: checked_in or checked_out';
COMMENT ON COLUMN access_logs.person_id IS 'Link to profiles table if visitor is a registered system user';
COMMENT ON COLUMN access_logs.booking_id IS 'Link to booking if visit is related to a booking';

