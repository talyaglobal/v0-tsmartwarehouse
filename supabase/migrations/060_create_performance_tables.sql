-- TSmart Warehouse Management System - Performance Tables
-- Create tables for brokers, customer groups, and performance targets
-- Generated: December 2024

-- ============================================
-- BROKERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS brokers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  company TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brokers_email ON brokers(email);
CREATE INDEX IF NOT EXISTS idx_brokers_name ON brokers(name);

-- ============================================
-- CUSTOMER GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customer_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_groups_name ON customer_groups(name);

-- ============================================
-- PERFORMANCE TARGETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS performance_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  floor_number INTEGER CHECK (floor_number IN (1, 2, 3)),
  target_capacity_percent DECIMAL(5, 2) NOT NULL DEFAULT 80.00,
  target_utilization_percent DECIMAL(5, 2) NOT NULL DEFAULT 75.00,
  filter_type TEXT CHECK (filter_type IN ('all', 'floor', 'warehouse', 'customer', 'broker', 'customer_group')),
  filter_id UUID, -- ID of the specific filter (customer_id, broker_id, customer_group_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, floor_number, filter_type, filter_id)
);

CREATE INDEX IF NOT EXISTS idx_performance_targets_warehouse_id ON performance_targets(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_performance_targets_filter ON performance_targets(filter_type, filter_id);
CREATE INDEX IF NOT EXISTS idx_performance_targets_floor ON performance_targets(floor_number);

-- ============================================
-- BROKER CUSTOMERS JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS broker_customers (
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (broker_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_customers_broker_id ON broker_customers(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_customers_customer_id ON broker_customers(customer_id);

-- ============================================
-- CUSTOMER GROUP MEMBERS JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customer_group_members (
  group_id UUID NOT NULL REFERENCES customer_groups(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_group_members_group_id ON customer_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_customer_group_members_customer_id ON customer_group_members(customer_id);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_group_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Brokers: All authenticated users can view, only admins can modify
CREATE POLICY "Users can view brokers"
  ON brokers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage brokers"
  ON brokers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Customer Groups: All authenticated users can view, only admins can modify
CREATE POLICY "Users can view customer groups"
  ON customer_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage customer groups"
  ON customer_groups FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Performance Targets: All authenticated users can view, only admins can modify
CREATE POLICY "Users can view performance targets"
  ON performance_targets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage performance targets"
  ON performance_targets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Broker Customers: Users can view their own broker relationships
CREATE POLICY "Users can view broker customers"
  ON broker_customers FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage broker customers"
  ON broker_customers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Customer Group Members: Users can view their own group memberships
CREATE POLICY "Users can view customer group members"
  ON customer_group_members FOR SELECT
  TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage customer group members"
  ON customer_group_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- TRIGGERS: Auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_brokers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_brokers_updated_at
  BEFORE UPDATE ON brokers
  FOR EACH ROW
  EXECUTE FUNCTION update_brokers_updated_at();

CREATE OR REPLACE FUNCTION update_customer_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_groups_updated_at
  BEFORE UPDATE ON customer_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_groups_updated_at();

CREATE OR REPLACE FUNCTION update_performance_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_performance_targets_updated_at
  BEFORE UPDATE ON performance_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_targets_updated_at();

