-- =====================================================
-- Migration: Restructure User Roles
-- Created: 2026-01-11
-- Purpose: Rename existing roles and add new transport-related roles
-- =====================================================

-- =====================================================
-- PART 1: ROLE RENAMING AND NEW ROLES
-- =====================================================

-- Step 1: Drop existing role constraint
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN 
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;
END $$;

-- Step 2: Migrate existing role data
-- warehouse_owner -> warehouse_admin (depo sahibi, tam yetki)
UPDATE profiles SET role = 'warehouse_admin' WHERE role = 'warehouse_owner';

-- warehouse_admin -> warehouse_supervisor (booking/service yonetimi)
-- Note: We need to do this after warehouse_owner migration to avoid conflicts
UPDATE profiles SET role = 'warehouse_supervisor' WHERE role = 'warehouse_admin' AND role != 'warehouse_admin';

-- Actually, let's do this properly with a temp column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_temp VARCHAR(50);

-- Copy current roles to temp
UPDATE profiles SET role_temp = role;

-- Now update based on temp column
UPDATE profiles SET role = 'warehouse_admin' WHERE role_temp = 'warehouse_owner';
UPDATE profiles SET role = 'warehouse_supervisor' WHERE role_temp = 'warehouse_admin';
UPDATE profiles SET role = 'warehouse_client' WHERE role_temp = 'customer';
UPDATE profiles SET role = 'warehouse_broker' WHERE role_temp = 'reseller';

-- Drop temp column
ALTER TABLE profiles DROP COLUMN IF EXISTS role_temp;

-- Step 3: Add new constraint with all roles (10 total)
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check 
CHECK (role IN (
  'root',                    -- System Admin
  'warehouse_admin',         -- Warehouse Owner (formerly warehouse_owner) - full access
  'warehouse_supervisor',    -- Warehouse Manager (formerly warehouse_admin) - booking/service management
  'warehouse_client',        -- Customer (formerly customer) - rents space
  'warehouse_staff',         -- Warehouse Personnel - operations
  'warehouse_finder',        -- Warehouse Scout - finds new warehouses
  'warehouse_broker',        -- Reseller (formerly reseller) - commission sales
  'end_delivery_party',      -- End Delivery Company - receives products
  'local_transport',         -- Local Transport Company - domestic shipping
  'international_transport'  -- International Transport - cross-border shipping
));

-- Step 4: Update role column comment
COMMENT ON COLUMN profiles.role IS 'User role: root (System Admin), warehouse_admin (Warehouse Owner - full access), warehouse_supervisor (Warehouse Manager - booking/service), warehouse_client (Customer - rents space), warehouse_staff (Warehouse Personnel), warehouse_finder (Warehouse Scout), warehouse_broker (Reseller), end_delivery_party (End Delivery), local_transport (Local Transport), international_transport (International Transport)';

-- Step 5: Create indexes for new roles
CREATE INDEX IF NOT EXISTS idx_profiles_warehouse_admin ON profiles(role) WHERE role = 'warehouse_admin';
CREATE INDEX IF NOT EXISTS idx_profiles_warehouse_supervisor ON profiles(role) WHERE role = 'warehouse_supervisor';
CREATE INDEX IF NOT EXISTS idx_profiles_warehouse_client ON profiles(role) WHERE role = 'warehouse_client';
CREATE INDEX IF NOT EXISTS idx_profiles_warehouse_broker ON profiles(role) WHERE role = 'warehouse_broker';
CREATE INDEX IF NOT EXISTS idx_profiles_end_delivery_party ON profiles(role) WHERE role = 'end_delivery_party';
CREATE INDEX IF NOT EXISTS idx_profiles_local_transport ON profiles(role) WHERE role = 'local_transport';
CREATE INDEX IF NOT EXISTS idx_profiles_international_transport ON profiles(role) WHERE role = 'international_transport';

-- Drop old indexes that are no longer valid
DROP INDEX IF EXISTS idx_profiles_warehouse_owner;
DROP INDEX IF EXISTS idx_profiles_customer;
DROP INDEX IF EXISTS idx_profiles_reseller;

-- =====================================================
-- PART 2: TRANSPORT COMPANIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS transport_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company Information
  company_name VARCHAR(255) NOT NULL,
  company_type VARCHAR(50) NOT NULL CHECK (company_type IN ('local', 'international', 'end_delivery')),
  tax_number VARCHAR(50),
  registration_number VARCHAR(100),
  
  -- Contact Information
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'USA',
  zip_code VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  
  -- Primary Contact Person
  contact_person_name VARCHAR(255),
  contact_person_phone VARCHAR(50),
  contact_person_email VARCHAR(255),
  
  -- Licensing and Certification
  license_number VARCHAR(100),
  license_expiry DATE,
  insurance_number VARCHAR(100),
  insurance_expiry DATE,
  dot_number VARCHAR(50), -- Department of Transportation number (US)
  mc_number VARCHAR(50),  -- Motor Carrier number (US)
  
  -- Service Areas
  service_areas JSONB DEFAULT '[]'::jsonb, -- Array of cities/regions served
  service_countries JSONB DEFAULT '["USA"]'::jsonb, -- For international
  
  -- Linked User Account (if they have login)
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(id),
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Indexes for transport_companies
CREATE INDEX IF NOT EXISTS idx_transport_companies_type ON transport_companies(company_type);
CREATE INDEX IF NOT EXISTS idx_transport_companies_user_id ON transport_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_transport_companies_active ON transport_companies(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_transport_companies_city ON transport_companies(city);
CREATE INDEX IF NOT EXISTS idx_transport_companies_country ON transport_companies(country);

-- =====================================================
-- PART 3: TRANSPORT DRIVERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS transport_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company Association
  transport_company_id UUID NOT NULL REFERENCES transport_companies(id) ON DELETE CASCADE,
  
  -- Linked User Account (if they have login)
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Driver Information
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  photo_url VARCHAR(500),
  
  -- License Information
  license_number VARCHAR(100) NOT NULL,
  license_type VARCHAR(50), -- CDL-A, CDL-B, etc.
  license_state VARCHAR(50),
  license_expiry DATE,
  
  -- Vehicle Information (primary vehicle)
  license_plate VARCHAR(50),
  vehicle_type VARCHAR(100), -- Truck, Van, Semi, etc.
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_year INTEGER,
  vehicle_capacity VARCHAR(100), -- e.g., "40ft", "20 pallets"
  
  -- Additional Certifications
  hazmat_certified BOOLEAN DEFAULT false,
  hazmat_expiry DATE,
  twic_card BOOLEAN DEFAULT false, -- Transportation Worker ID
  twic_expiry DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  availability_status VARCHAR(50) DEFAULT 'available' CHECK (availability_status IN ('available', 'on_job', 'off_duty', 'unavailable')),
  
  -- Current Location (for tracking)
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_location_update TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Indexes for transport_drivers
CREATE INDEX IF NOT EXISTS idx_transport_drivers_company ON transport_drivers(transport_company_id);
CREATE INDEX IF NOT EXISTS idx_transport_drivers_user_id ON transport_drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_transport_drivers_active ON transport_drivers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_transport_drivers_availability ON transport_drivers(availability_status);
CREATE INDEX IF NOT EXISTS idx_transport_drivers_plate ON transport_drivers(license_plate);

-- =====================================================
-- PART 4: TRANSPORT VEHICLES TABLE (Optional additional vehicles)
-- =====================================================

CREATE TABLE IF NOT EXISTS transport_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company Association
  transport_company_id UUID NOT NULL REFERENCES transport_companies(id) ON DELETE CASCADE,
  
  -- Primary Driver (optional)
  primary_driver_id UUID REFERENCES transport_drivers(id) ON DELETE SET NULL,
  
  -- Vehicle Information
  license_plate VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(100) NOT NULL, -- Truck, Van, Semi, Flatbed, Refrigerated, etc.
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_year INTEGER,
  vin_number VARCHAR(50),
  
  -- Capacity
  capacity_weight DECIMAL(10, 2), -- in kg or lbs
  capacity_volume DECIMAL(10, 2), -- in cubic meters or cubic feet
  capacity_pallets INTEGER,
  max_dimensions JSONB, -- { length, width, height }
  
  -- Special Features
  is_refrigerated BOOLEAN DEFAULT false,
  temperature_min DECIMAL(5, 2),
  temperature_max DECIMAL(5, 2),
  has_lift_gate BOOLEAN DEFAULT false,
  has_pallet_jack BOOLEAN DEFAULT false,
  
  -- Documentation
  registration_expiry DATE,
  insurance_expiry DATE,
  last_inspection_date DATE,
  next_inspection_due DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'out_of_service')),
  
  -- Current Location
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_location_update TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Indexes for transport_vehicles
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_company ON transport_vehicles(transport_company_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_driver ON transport_vehicles(primary_driver_id);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_plate ON transport_vehicles(license_plate);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_type ON transport_vehicles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_transport_vehicles_status ON transport_vehicles(status);

-- =====================================================
-- PART 5: SHIPMENTS TABLE (Links bookings to transport)
-- =====================================================

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  shipment_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Booking Association
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Shipment Type
  shipment_type VARCHAR(50) NOT NULL CHECK (shipment_type IN ('inbound', 'outbound', 'transfer')),
  
  -- Transport Companies
  local_transport_id UUID REFERENCES transport_companies(id),
  international_transport_id UUID REFERENCES transport_companies(id),
  end_delivery_party_id UUID REFERENCES transport_companies(id),
  
  -- Driver and Vehicle (for local transport)
  driver_id UUID REFERENCES transport_drivers(id),
  vehicle_id UUID REFERENCES transport_vehicles(id),
  
  -- Origin
  origin_address TEXT,
  origin_city VARCHAR(100),
  origin_state VARCHAR(100),
  origin_country VARCHAR(100),
  origin_zip VARCHAR(20),
  origin_latitude DECIMAL(10, 8),
  origin_longitude DECIMAL(11, 8),
  origin_contact_name VARCHAR(255),
  origin_contact_phone VARCHAR(50),
  
  -- Destination
  destination_address TEXT,
  destination_city VARCHAR(100),
  destination_state VARCHAR(100),
  destination_country VARCHAR(100),
  destination_zip VARCHAR(20),
  destination_latitude DECIMAL(10, 8),
  destination_longitude DECIMAL(11, 8),
  destination_contact_name VARCHAR(255),
  destination_contact_phone VARCHAR(50),
  
  -- Cargo Details
  cargo_description TEXT,
  total_weight DECIMAL(10, 2),
  weight_unit VARCHAR(10) DEFAULT 'kg',
  total_volume DECIMAL(10, 2),
  volume_unit VARCHAR(10) DEFAULT 'cbm',
  pallet_count INTEGER,
  package_count INTEGER,
  
  -- Special Requirements
  is_hazmat BOOLEAN DEFAULT false,
  hazmat_class VARCHAR(50),
  requires_refrigeration BOOLEAN DEFAULT false,
  temperature_requirement JSONB, -- { min, max, unit }
  special_handling TEXT,
  
  -- Scheduling
  scheduled_pickup_date DATE,
  scheduled_pickup_time TIME,
  actual_pickup_at TIMESTAMPTZ,
  scheduled_delivery_date DATE,
  scheduled_delivery_time TIME,
  actual_delivery_at TIMESTAMPTZ,
  estimated_transit_days INTEGER,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'dispatched', 'picked_up', 
    'in_transit', 'at_customs', 'out_for_delivery', 
    'delivered', 'cancelled', 'on_hold', 'exception'
  )),
  status_history JSONB DEFAULT '[]'::jsonb,
  
  -- Customs (for international)
  customs_status VARCHAR(50),
  customs_declaration_number VARCHAR(100),
  customs_cleared_at TIMESTAMPTZ,
  
  -- Proof of Delivery
  pod_signature_url VARCHAR(500),
  pod_photo_urls JSONB DEFAULT '[]'::jsonb,
  pod_received_by VARCHAR(255),
  pod_notes TEXT,
  
  -- Costs
  transport_cost DECIMAL(10, 2),
  customs_cost DECIMAL(10, 2),
  insurance_cost DECIMAL(10, 2),
  other_costs DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Tracking
  tracking_number VARCHAR(100),
  tracking_url VARCHAR(500),
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_tracking_update TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  internal_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Generate shipment number
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shipment_number IS NULL THEN
    NEW.shipment_number := 'SHP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('shipment_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for shipment numbers
CREATE SEQUENCE IF NOT EXISTS shipment_number_seq START 1;

-- Create trigger for shipment number
DROP TRIGGER IF EXISTS set_shipment_number ON shipments;
CREATE TRIGGER set_shipment_number
  BEFORE INSERT ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION generate_shipment_number();

-- Indexes for shipments
CREATE INDEX IF NOT EXISTS idx_shipments_booking ON shipments(booking_id);
CREATE INDEX IF NOT EXISTS idx_shipments_local_transport ON shipments(local_transport_id);
CREATE INDEX IF NOT EXISTS idx_shipments_international_transport ON shipments(international_transport_id);
CREATE INDEX IF NOT EXISTS idx_shipments_end_delivery ON shipments(end_delivery_party_id);
CREATE INDEX IF NOT EXISTS idx_shipments_driver ON shipments(driver_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_type ON shipments(shipment_type);
CREATE INDEX IF NOT EXISTS idx_shipments_scheduled_pickup ON shipments(scheduled_pickup_date);
CREATE INDEX IF NOT EXISTS idx_shipments_scheduled_delivery ON shipments(scheduled_delivery_date);

-- =====================================================
-- PART 6: ADD TRANSPORT REFERENCES TO BOOKINGS
-- =====================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_delivery_party_id UUID REFERENCES transport_companies(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS local_transport_id UUID REFERENCES transport_companies(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS international_transport_id UUID REFERENCES transport_companies(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES transport_drivers(id);

-- =====================================================
-- PART 7: WAREHOUSE STAFF TASK WORKFLOW
-- =====================================================

-- Task types for warehouse staff workflow
CREATE TABLE IF NOT EXISTS staff_task_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  workflow_order INTEGER NOT NULL,
  estimated_duration_minutes INTEGER DEFAULT 30,
  requires_photo BOOLEAN DEFAULT false,
  requires_signature BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default task types based on warehouse staff workflow
INSERT INTO staff_task_types (code, name, description, workflow_order, requires_photo) VALUES
  ('unload_goods', 'Unload Goods', 'Unload incoming goods from transport', 0, true),
  ('acceptance', 'Goods Acceptance', 'Accept and verify incoming goods', 1, true),
  ('placement', 'Warehouse Placement', 'Place goods at designated warehouse location', 2, true),
  ('customer_contact', 'Customer Contact', 'Contact customer for scheduling (pickup/delivery)', 3, false),
  ('locate_goods', 'Locate Goods', 'Find and prepare goods for shipment day', 4, false),
  ('prepare_loading', 'Prepare for Loading', 'Prepare goods for loading onto transport', 5, true),
  ('load_goods', 'Load Goods', 'Load goods onto transport', 6, true),
  ('inventory_count', 'Inventory Count', 'Perform warehouse inventory count', 7, false),
  ('warehouse_cleaning', 'Warehouse Cleaning', 'Clean warehouse areas', 8, false),
  ('reorganization', 'Warehouse Optimization', 'Reorganize warehouse for better efficiency', 9, false),
  ('special_services', 'Special Services', 'Labeling, re-palletization, shipment blocking, etc.', 10, true)
ON CONFLICT (code) DO NOTHING;

-- Staff tasks table (instances of tasks for bookings/services)
CREATE TABLE IF NOT EXISTS staff_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Task Type
  task_type_id UUID NOT NULL REFERENCES staff_task_types(id),
  
  -- Associations
  booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE,
  service_order_id UUID, -- Reference to service orders if exists
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  
  -- Assignment
  assigned_to UUID REFERENCES profiles(id),
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ,
  
  -- Location
  warehouse_zone VARCHAR(50),
  warehouse_aisle VARCHAR(50),
  warehouse_rack VARCHAR(50),
  warehouse_level VARCHAR(50),
  pallet_ids JSONB DEFAULT '[]'::jsonb,
  
  -- Scheduling
  scheduled_date DATE,
  scheduled_time TIME,
  due_date DATE,
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending', 'assigned', 'in_progress', 'paused', 
    'completed', 'cancelled', 'blocked'
  )),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Completion Details
  completion_notes TEXT,
  completion_photos JSONB DEFAULT '[]'::jsonb,
  signature_url VARCHAR(500),
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  
  -- Time Tracking
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  
  -- Metadata
  instructions TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Indexes for staff_tasks
CREATE INDEX IF NOT EXISTS idx_staff_tasks_type ON staff_tasks(task_type_id);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_booking ON staff_tasks(booking_id);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_warehouse ON staff_tasks(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned_to ON staff_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_status ON staff_tasks(status);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_scheduled ON staff_tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_priority ON staff_tasks(priority);

-- =====================================================
-- PART 8: UPDATE TRIGGERS
-- =====================================================

-- Updated_at trigger for transport_companies
CREATE OR REPLACE FUNCTION update_transport_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_transport_companies_updated_at ON transport_companies;
CREATE TRIGGER set_transport_companies_updated_at
  BEFORE UPDATE ON transport_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_companies_updated_at();

-- Updated_at trigger for transport_drivers
CREATE OR REPLACE FUNCTION update_transport_drivers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_transport_drivers_updated_at ON transport_drivers;
CREATE TRIGGER set_transport_drivers_updated_at
  BEFORE UPDATE ON transport_drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_drivers_updated_at();

-- Updated_at trigger for transport_vehicles
CREATE OR REPLACE FUNCTION update_transport_vehicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_transport_vehicles_updated_at ON transport_vehicles;
CREATE TRIGGER set_transport_vehicles_updated_at
  BEFORE UPDATE ON transport_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_transport_vehicles_updated_at();

-- Updated_at trigger for shipments
CREATE OR REPLACE FUNCTION update_shipments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_shipments_updated_at ON shipments;
CREATE TRIGGER set_shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_shipments_updated_at();

-- Updated_at trigger for staff_tasks
CREATE OR REPLACE FUNCTION update_staff_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_staff_tasks_updated_at ON staff_tasks;
CREATE TRIGGER set_staff_tasks_updated_at
  BEFORE UPDATE ON staff_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_tasks_updated_at();

-- =====================================================
-- PART 9: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_tasks ENABLE ROW LEVEL SECURITY;

-- Transport Companies Policies
CREATE POLICY "Users can view transport companies" ON transport_companies
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      is_active = true
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('root', 'warehouse_admin', 'warehouse_supervisor')
      )
    )
  );

CREATE POLICY "Transport users can update their own company" ON transport_companies
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage transport companies" ON transport_companies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin')
    )
  );

-- Transport Drivers Policies
CREATE POLICY "Users can view active drivers" ON transport_drivers
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      is_active = true
      OR user_id = auth.uid()
      OR transport_company_id IN (
        SELECT id FROM transport_companies WHERE user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('root', 'warehouse_admin', 'warehouse_supervisor')
      )
    )
  );

CREATE POLICY "Transport companies can manage their drivers" ON transport_drivers
  FOR ALL USING (
    transport_company_id IN (
      SELECT id FROM transport_companies WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin')
    )
  );

-- Transport Vehicles Policies
CREATE POLICY "Users can view vehicles" ON transport_vehicles
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      transport_company_id IN (
        SELECT id FROM transport_companies WHERE user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('root', 'warehouse_admin', 'warehouse_supervisor')
      )
    )
  );

CREATE POLICY "Transport companies can manage their vehicles" ON transport_vehicles
  FOR ALL USING (
    transport_company_id IN (
      SELECT id FROM transport_companies WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin')
    )
  );

-- Shipments Policies
CREATE POLICY "Users can view their shipments" ON shipments
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      created_by = auth.uid()
      OR booking_id IN (SELECT id FROM bookings WHERE customer_id = auth.uid())
      OR local_transport_id IN (SELECT id FROM transport_companies WHERE user_id = auth.uid())
      OR international_transport_id IN (SELECT id FROM transport_companies WHERE user_id = auth.uid())
      OR end_delivery_party_id IN (SELECT id FROM transport_companies WHERE user_id = auth.uid())
      OR driver_id IN (SELECT id FROM transport_drivers WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('root', 'warehouse_admin', 'warehouse_supervisor', 'warehouse_staff')
      )
    )
  );

CREATE POLICY "Admins can manage shipments" ON shipments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin', 'warehouse_supervisor')
    )
  );

-- Staff Task Types Policies (read-only for most users)
CREATE POLICY "Anyone can view active task types" ON staff_task_types
  FOR SELECT USING (is_active = true);

CREATE POLICY "Only root can manage task types" ON staff_task_types
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'root'
    )
  );

-- Staff Tasks Policies
CREATE POLICY "Staff can view their tasks" ON staff_tasks
  FOR SELECT USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin', 'warehouse_supervisor')
    )
  );

CREATE POLICY "Staff can update their assigned tasks" ON staff_tasks
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin', 'warehouse_supervisor')
    )
  );

CREATE POLICY "Supervisors can create and manage tasks" ON staff_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('root', 'warehouse_admin', 'warehouse_supervisor')
    )
  );

-- =====================================================
-- PART 10: COMMENTS
-- =====================================================

COMMENT ON TABLE transport_companies IS 'Transport companies for local, international, and end delivery services';
COMMENT ON TABLE transport_drivers IS 'Drivers associated with transport companies';
COMMENT ON TABLE transport_vehicles IS 'Vehicles owned by transport companies';
COMMENT ON TABLE shipments IS 'Shipment records linking bookings to transport';
COMMENT ON TABLE staff_task_types IS 'Types of tasks for warehouse staff workflow';
COMMENT ON TABLE staff_tasks IS 'Individual task instances for warehouse staff';

COMMENT ON COLUMN transport_companies.company_type IS 'local: domestic transport, international: cross-border, end_delivery: final delivery to customer';
COMMENT ON COLUMN transport_drivers.availability_status IS 'Current availability: available, on_job, off_duty, unavailable';
COMMENT ON COLUMN shipments.shipment_type IS 'inbound: coming to warehouse, outbound: leaving warehouse, transfer: between warehouses';
COMMENT ON COLUMN staff_tasks.priority IS 'Task priority: low, normal, high, urgent';
