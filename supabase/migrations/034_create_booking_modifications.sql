-- Create booking modifications table
-- This tracks changes to bookings (add/remove pallets, area, extend/reduce duration)

CREATE TABLE IF NOT EXISTS booking_modifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  modification_type TEXT NOT NULL CHECK (modification_type IN ('add_pallets', 'remove_pallets', 'add_area', 'remove_area', 'extend', 'reduce')),
  old_value INTEGER, -- Old pallet count or area sq ft
  new_value INTEGER, -- New pallet count or area sq ft
  effective_date DATE NOT NULL, -- When the modification takes effect
  reason TEXT,
  approved_by UUID REFERENCES profiles(id), -- Warehouse owner who approved
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_booking_modifications_booking_id ON booking_modifications(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_modifications_effective_date ON booking_modifications(effective_date);
CREATE INDEX IF NOT EXISTS idx_booking_modifications_type ON booking_modifications(modification_type);

-- Enable Row Level Security
ALTER TABLE booking_modifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Customers can view modifications for their bookings
CREATE POLICY "Customers can view own modifications"
  ON booking_modifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_modifications.booking_id
      AND bookings.customer_id = auth.uid()
    )
  );

-- Warehouse owners can manage modifications for their warehouses
CREATE POLICY "Warehouse owners can manage modifications"
  ON booking_modifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      JOIN warehouses ON warehouses.id = bookings.warehouse_id
      WHERE bookings.id = booking_modifications.booking_id
      AND warehouses.owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- System admins can manage all modifications
CREATE POLICY "Admins can manage all modifications"
  ON booking_modifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

