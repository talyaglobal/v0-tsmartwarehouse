-- Create warehouse_staff table
-- This table manages staff assignments to warehouses

CREATE TABLE IF NOT EXISTS warehouse_staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('manager', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_staff_warehouse_id ON warehouse_staff(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_staff_user_id ON warehouse_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_staff_role ON warehouse_staff(role);

-- Enable Row Level Security
ALTER TABLE warehouse_staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Warehouse staff can view their own assignments
CREATE POLICY "Staff can view own assignments"
  ON warehouse_staff FOR SELECT
  USING (auth.uid() = user_id);

-- Warehouse owners can manage staff for their warehouses
CREATE POLICY "Warehouse owners can manage staff"
  ON warehouse_staff FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM warehouses
      WHERE warehouses.id = warehouse_staff.warehouse_id
      AND warehouses.owner_company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- System admins can manage all staff
CREATE POLICY "Admins can manage all staff"
  ON warehouse_staff FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

