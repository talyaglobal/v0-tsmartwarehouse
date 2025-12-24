-- Create warehouse pricing tables
-- This allows warehouse owners to set their own pricing

-- Warehouse pricing table
CREATE TABLE IF NOT EXISTS warehouse_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('pallet', 'area')),
  base_price DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL, -- 'per_pallet_per_month', 'per_sqft_per_month', 'per_sqft_per_year'
  min_quantity INTEGER, -- Minimum pallet/sqft
  max_quantity INTEGER, -- Maximum pallet/sqft
  volume_discounts JSONB, -- {threshold: discount_percentage} e.g., {"50": 5, "100": 10, "250": 15}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, pricing_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_pricing_warehouse_id ON warehouse_pricing(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_pricing_type ON warehouse_pricing(pricing_type);

-- Enable Row Level Security
ALTER TABLE warehouse_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Warehouse owners can manage pricing for their warehouses
CREATE POLICY "Warehouse owners can manage pricing"
  ON warehouse_pricing FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM warehouses
      WHERE warehouses.id = warehouse_pricing.warehouse_id
      AND warehouses.owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Customers can view pricing (for marketplace)
CREATE POLICY "Customers can view pricing"
  ON warehouse_pricing FOR SELECT
  USING (true); -- Public pricing for marketplace

-- System admins can manage all pricing
CREATE POLICY "Admins can manage all pricing"
  ON warehouse_pricing FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Booking proposals table
CREATE TABLE IF NOT EXISTS booking_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES profiles(id),
  proposed_price DECIMAL(10,2) NOT NULL,
  terms JSONB, -- Additional terms and conditions
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_booking_proposals_booking_id ON booking_proposals(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_proposals_proposed_by ON booking_proposals(proposed_by);
CREATE INDEX IF NOT EXISTS idx_booking_proposals_status ON booking_proposals(status);
CREATE INDEX IF NOT EXISTS idx_booking_proposals_expires_at ON booking_proposals(expires_at);

-- Enable Row Level Security
ALTER TABLE booking_proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for booking_proposals
-- Warehouse owners can create proposals for bookings on their warehouses
CREATE POLICY "Warehouse owners can create proposals"
  ON booking_proposals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      JOIN warehouses ON warehouses.id = bookings.warehouse_id
      WHERE bookings.id = booking_proposals.booking_id
      AND warehouses.owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Customers can view and update proposals for their bookings
CREATE POLICY "Customers can manage own proposals"
  ON booking_proposals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_proposals.booking_id
      AND bookings.customer_id = auth.uid()
    )
  );

-- Warehouse owners can view proposals for their warehouses
CREATE POLICY "Warehouse owners can view proposals"
  ON booking_proposals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      JOIN warehouses ON warehouses.id = bookings.warehouse_id
      WHERE bookings.id = booking_proposals.booking_id
      AND warehouses.owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- System admins can manage all proposals
CREATE POLICY "Admins can manage all proposals"
  ON booking_proposals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Update bookings table to reference proposals
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES booking_proposals(id),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_proposal_id ON bookings(proposal_id);
CREATE INDEX IF NOT EXISTS idx_bookings_approved_by ON bookings(approved_by);

